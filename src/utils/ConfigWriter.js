import GLib from "gi://GLib";
import Gio from "gi://Gio";

import {
  readFileAsText,
  writeTextToFile,
  saveJsonFile,
  copyFile,
  ensureDirectoryExists,
  cleanDirectory,
  enumerateDirectory,
} from "./file-utils.js";
import { hexToRgbString, hexToRgba, hexToYaruTheme } from "./color-utils.js";
import { DEFAULT_COLORS } from "../constants/colors.js";

export class ConfigWriter {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;

    this.projectDir = GLib.path_get_dirname(
      GLib.path_get_dirname(
        GLib.path_get_dirname(
          Gio.File.new_for_path(
            import.meta.url.replace("file://", ""),
          ).get_path(),
        ),
      ),
    );
    this.templatesDir = GLib.build_filenamev([this.projectDir, "templates"]);
  }

  _writeTheme(themeDir, colorRoles, wallpaperPath, options = {}) {
    ensureDirectoryExists(themeDir);

    if (options.copyWallpaper && wallpaperPath) {
      const bgDir = GLib.build_filenamev([themeDir, "backgrounds"]);
      ensureDirectoryExists(bgDir);
      cleanDirectory(bgDir);
      this._copyWallpaper(wallpaperPath, bgDir);
    }

    const variables = this._buildVariables(colorRoles);
    this._processTemplates(variables, themeDir);
    this._writeColorsJson(colorRoles, themeDir);

    if (options.executePosthook) {
      const posthookScript = this.settingsManager.get("posthookScript");
      if (posthookScript && posthookScript.trim()) {
        this._executePosthook(posthookScript, "tinte", wallpaperPath);
      }
    }
  }

  applyTheme(colorRoles, wallpaperPath, settings = {}) {
    try {
      const themeDir = this.settingsManager.get("applyThemeLocation");
      this._writeTheme(themeDir, colorRoles, wallpaperPath, {
        executePosthook: true,
        copyWallpaper: false,
      });
      console.log(`Theme applied successfully to: ${themeDir}`);
      return true;
    } catch (e) {
      console.error("Error applying theme:", e.message);
      return false;
    }
  }

  exportTheme(themeName, colorRoles, wallpaperPath) {
    try {
      const exportBase = this.settingsManager.get("exportThemeLocation");
      const themeDir = GLib.build_filenamev([exportBase, themeName]);
      this._writeTheme(themeDir, colorRoles, wallpaperPath, {
        executePosthook: false,
        copyWallpaper: true,
      });
      console.log(`Theme exported successfully to: ${themeDir}`);
      return true;
    } catch (e) {
      console.error("Error exporting theme:", e.message);
      return false;
    }
  }

  _copyWallpaper(sourcePath, destDir) {
    const fileName = GLib.path_get_basename(sourcePath);
    const destPath = GLib.build_filenamev([destDir, fileName]);
    copyFile(sourcePath, destPath);
    return destPath;
  }

  _buildVariables(colorRoles) {
    const variables = {};

    Object.keys(DEFAULT_COLORS).forEach((key) => {
      variables[key] = colorRoles[key] || DEFAULT_COLORS[key];
    });

    variables.theme_type = "dark";

    return variables;
  }

  _processTemplates(variables, outputDir) {
    enumerateDirectory(
      this.templatesDir,
      (fileInfo, templatePath, fileName) => {
        if (
          fileInfo.get_file_type() === Gio.FileType.DIRECTORY ||
          fileName.startsWith(".") ||
          fileName === "vscode-extension" ||
          fileName === "vscode.empty.json"
        ) {
          return;
        }

        const outputPath = GLib.build_filenamev([outputDir, fileName]);

        try {
          const content = readFileAsText(templatePath);
          const processed = this._replaceVariables(content, variables);
          writeTextToFile(outputPath, processed);
          console.log(`Processed template: ${fileName}`);
        } catch (e) {
          console.error(`Error processing template ${fileName}:`, e.message);
        }
      },
    );
  }

  _replaceVariables(content, variables) {
    let result = content;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      result = result.replace(regex, value);

      const stripRegex = new RegExp(`\\{${key}\\.strip\\}`, "g");
      const strippedValue =
        typeof value === "string" ? value.replace("#", "") : value;
      result = result.replace(stripRegex, strippedValue);

      const rgbRegex = new RegExp(`\\{${key}\\.rgb\\}`, "g");
      if (typeof value === "string" && value.startsWith("#")) {
        const rgbValue = hexToRgbString(value);
        result = result.replace(rgbRegex, rgbValue);
      } else {
        result = result.replace(rgbRegex, value);
      }

      const rgbaRegex = new RegExp(
        `\\{${key}\\.rgba(?::(\\d*\\.?\\d+))?\\}`,
        "g",
      );
      if (typeof value === "string" && value.startsWith("#")) {
        result = result.replace(rgbaRegex, (match, alpha) => {
          const alphaValue = alpha ? parseFloat(alpha) : 1.0;
          return hexToRgba(value, alphaValue);
        });
      } else {
        result = result.replace(rgbaRegex, value);
      }

      const yaruRegex = new RegExp(`\\{${key}\\.yaru\\}`, "g");
      if (typeof value === "string" && value.startsWith("#")) {
        const yaruTheme = hexToYaruTheme(value);
        result = result.replace(yaruRegex, yaruTheme);
      } else {
        result = result.replace(yaruRegex, value);
      }
    });

    return result;
  }

  _writeColorsJson(colorRoles, themeDir) {
    const colorsJsonPath = GLib.build_filenamev([themeDir, "colors.json"]);

    const data = {
      background: colorRoles.background,
      foreground: colorRoles.foreground,
      colors: [
        colorRoles.color0,
        colorRoles.color1,
        colorRoles.color2,
        colorRoles.color3,
        colorRoles.color4,
        colorRoles.color5,
        colorRoles.color6,
        colorRoles.color7,
        colorRoles.color8,
        colorRoles.color9,
        colorRoles.color10,
        colorRoles.color11,
        colorRoles.color12,
        colorRoles.color13,
        colorRoles.color14,
        colorRoles.color15,
      ],
    };

    saveJsonFile(colorsJsonPath, data);
    console.log(`Wrote colors.json to ${colorsJsonPath}`);
  }

  _executePosthook(scriptPath, themeName, wallpaperPath) {
    try {
      const args = wallpaperPath
        ? [scriptPath, themeName, wallpaperPath]
        : [scriptPath, themeName];
      console.log(`Executing posthook: ${args.join(" ")}`);
      GLib.spawn_async(null, args, null, GLib.SpawnFlags.SEARCH_PATH, null);
    } catch (e) {
      console.error(`Error executing posthook script: ${e.message}`);
    }
  }
}
