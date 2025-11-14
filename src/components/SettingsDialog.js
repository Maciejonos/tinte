import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";
import Gio from "gi://Gio";

import { ThumbnailService } from "../services/thumbnail-service.js";
import { SignalManager } from "../utils/SignalManager.js";

export const SettingsDialog = GObject.registerClass(
  class SettingsDialog extends Adw.PreferencesWindow {
    _init(parent, settingsManager) {
      super._init({
        title: "Settings",
        modal: true,
        transient_for: parent,
        search_enabled: false,
      });

      this.settingsManager = settingsManager;
      this.thumbnailService = new ThumbnailService();
      this._previousWallpaperFolder = settingsManager.get("wallpaperFolder");
      this._signals = new SignalManager();
      this._buildUI();

      this.connect('unrealize', () => {
        this._signals.disconnectAll();
      });
    }

    _buildUI() {
      const page = new Adw.PreferencesPage();

      const backendGroup = new Adw.PreferencesGroup({
        title: "Color Extraction",
        description: "Choose the backend for generating color palettes",
      });

      const backendRow = new Adw.ComboRow({
        title: "Backend",
        subtitle: "Tool used for extracting colors from wallpapers",
      });

      const backendModel = Gtk.StringList.new(["ImageMagick", "Matugen"]);
      backendRow.set_model(backendModel);

      const currentBackend = this.settingsManager.get("colorBackend");
      backendRow.set_selected(currentBackend === "matugen" ? 1 : 0);

      this._signals.connect(backendRow, "notify::selected", () => {
        const backend =
          backendRow.get_selected() === 0 ? "imagemagick" : "matugen";
        this.settingsManager.set("colorBackend", backend);
      });

      backendGroup.add(backendRow);

      const wallpaperBackendRow = new Adw.ComboRow({
        title: "Wallpaper Backend",
        subtitle: "Tool used for setting wallpapers",
      });

      const wallpaperBackendModel = Gtk.StringList.new([
        "Not configured",
        "swaybg",
        "hyprpaper",
      ]);
      wallpaperBackendRow.set_model(wallpaperBackendModel);

      const currentWallpaperBackend = this.settingsManager.get("wallpaperBackend");
      if (currentWallpaperBackend === "swaybg") {
        wallpaperBackendRow.set_selected(1);
      } else if (currentWallpaperBackend === "hyprpaper") {
        wallpaperBackendRow.set_selected(2);
      } else {
        wallpaperBackendRow.set_selected(0);
      }

      this._signals.connect(wallpaperBackendRow, "notify::selected", () => {
        const selected = wallpaperBackendRow.get_selected();
        let wpBackend = null;
        if (selected === 1) {
          wpBackend = "swaybg";
        } else if (selected === 2) {
          wpBackend = "hyprpaper";
        }
        this.settingsManager.set("wallpaperBackend", wpBackend);
      });

      backendGroup.add(wallpaperBackendRow);
      page.add(backendGroup);

      const group = new Adw.PreferencesGroup({
        title: "Paths",
        description: "Configure directories and scripts for Tinte",
      });

      this._wallpaperFolderRow = this._createPathRow(
        "Wallpaper Folder",
        "Directory to browse for wallpapers",
        this.settingsManager.get("wallpaperFolder"),
        "wallpaperFolder",
        Gtk.FileChooserAction.SELECT_FOLDER,
      );
      group.add(this._wallpaperFolderRow);

      this._posthookScriptRow = this._createPathRow(
        "Posthook Script",
        "Script to run after applying theme (optional)",
        this.settingsManager.get("posthookScript") || "",
        "posthookScript",
        Gtk.FileChooserAction.OPEN,
        true,
      );
      group.add(this._posthookScriptRow);

      this._exportLocationRow = this._createPathRow(
        "Export Theme Location",
        "Base directory for exported themes",
        this.settingsManager.get("exportThemeLocation"),
        "exportThemeLocation",
        Gtk.FileChooserAction.SELECT_FOLDER,
      );
      group.add(this._exportLocationRow);

      this._applyLocationRow = this._createPathRow(
        "Apply Theme Location",
        "Directory where Apply Theme writes configs",
        this.settingsManager.get("applyThemeLocation"),
        "applyThemeLocation",
        Gtk.FileChooserAction.SELECT_FOLDER,
      );
      group.add(this._applyLocationRow);

      page.add(group);
      this.add(page);
    }

    _createPathRow(
      title,
      subtitle,
      currentPath,
      settingKey,
      action,
      allowEmpty = false,
    ) {
      const row = new Adw.ActionRow({
        title: title,
        subtitle: subtitle,
      });

      const pathBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        valign: Gtk.Align.CENTER,
      });

      const entry = new Gtk.Entry({
        text: currentPath || "",
        hexpand: true,
        placeholder_text: allowEmpty ? "None (optional)" : "Select path...",
      });

      const browseBtn = new Gtk.Button({
        icon_name: "folder-open-symbolic",
        tooltip_text: "Browse...",
      });

      this._signals.connect(browseBtn, "clicked", () => {
        this._showFileChooser(action, entry, settingKey, allowEmpty);
      });

      this._signals.connect(entry, "changed", () => {
        const newPath = entry.get_text().trim();
        if (allowEmpty || newPath) {
          if (
            settingKey === "wallpaperFolder" &&
            newPath !== this._previousWallpaperFolder
          ) {
            console.log("Wallpaper folder changed, clearing thumbnail cache");
            this.thumbnailService.clearCache();
            this._previousWallpaperFolder = newPath;
          }

          this.settingsManager.set(settingKey, newPath);
        }
      });

      pathBox.append(entry);
      pathBox.append(browseBtn);
      row.add_suffix(pathBox);

      return row;
    }

    _showFileChooser(action, entry, settingKey, allowEmpty) {
      const dialog = new Gtk.FileDialog({
        title: "Select Path",
        modal: true,
      });

      const callback = (dlg, result) => {
        try {
          const file =
            action === Gtk.FileChooserAction.SELECT_FOLDER
              ? dlg.select_folder_finish(result)
              : dlg.open_finish(result);

          if (file) {
            const path = file.get_path();

            if (
              settingKey === "wallpaperFolder" &&
              path !== this._previousWallpaperFolder
            ) {
              console.log("Wallpaper folder changed, clearing thumbnail cache");
              this.thumbnailService.clearCache();
              this._previousWallpaperFolder = path;
            }

            entry.set_text(path);
            this.settingsManager.set(settingKey, path);
          }
        } catch (e) {
          if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
            console.error("Error selecting path:", e.message);
          }
        }
      };

      const currentPath = entry.get_text();
      if (currentPath) {
        try {
          const initialFile = Gio.File.new_for_path(currentPath);
          if (initialFile.query_exists(null)) {
            if (action === Gtk.FileChooserAction.SELECT_FOLDER) {
              dialog.set_initial_folder(initialFile);
            } else {
              const parent = initialFile.get_parent();
              if (parent) {
                dialog.set_initial_folder(parent);
              }
            }
          }
        } catch (e) {
          console.error("Error setting initial folder:", e.message);
        }
      }

      if (action === Gtk.FileChooserAction.SELECT_FOLDER) {
        dialog.select_folder(this, null, callback);
      } else {
        dialog.open(this, null, callback);
      }
    }
  },
);
