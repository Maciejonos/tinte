import GLib from "gi://GLib";
import {
  loadJsonFile,
  saveJsonFile,
  ensureDirectoryExists,
} from "../utils/file-utils.js";

export class SettingsManager {
  constructor() {
    this.configDir = GLib.build_filenamev([
      GLib.get_user_config_dir(),
      "tinte",
    ]);
    this.settingsPath = GLib.build_filenamev([this.configDir, "settings.json"]);

    ensureDirectoryExists(this.configDir);
    this.settings = this._loadSettings();
  }

  _getDefaults() {
    return {
      wallpaperFolder: GLib.build_filenamev([
        GLib.get_home_dir(),
        "Pictures",
        "wallpapers",
      ]),
      posthookScript: "",
      exportThemeLocation: GLib.build_filenamev([
        GLib.get_home_dir(),
        ".config",
        "tinte",
        "themes",
      ]),
      applyThemeLocation: GLib.build_filenamev([
        GLib.get_home_dir(),
        ".config",
        "themes",
        "tinte",
      ]),
      colorBackend: "imagemagick",
      wallpaperBackend: null,
    };
  }

  _loadSettings() {
    const defaults = this._getDefaults();
    const loaded = loadJsonFile(this.settingsPath, null);

    if (!loaded) {
      this.saveSettings(defaults);
      return defaults;
    }

    return { ...defaults, ...loaded };
  }

  saveSettings(settings) {
    this.settings = settings;
    saveJsonFile(this.settingsPath, settings);
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.saveSettings(this.settings);
  }

  getAll() {
    return { ...this.settings };
  }
}
