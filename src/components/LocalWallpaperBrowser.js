import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { ThumbnailService } from "../services/thumbnail-service.js";
import { SignalManager } from "../utils/SignalManager.js";

export const LocalWallpaperBrowser = GObject.registerClass(
  {
    Signals: {
      "wallpaper-selected": { param_types: [GObject.TYPE_STRING] },
    },
  },
  class LocalWallpaperBrowser extends Gtk.Box {
    _init(settingsManager) {
      super._init({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });

      this.settingsManager = settingsManager;
      this.thumbnailService = new ThumbnailService();
      this._wallpapers = [];
      this._signals = new SignalManager();

      this._buildUI();
      this._loadWallpapers();

      this.connect('unrealize', () => {
        this._signals.disconnectAll();
      });
    }

    _buildUI() {
      const header = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_bottom: 6,
      });

      const title = new Gtk.Label({
        label: "Browse Wallpapers",
        css_classes: ["title-2"],
        hexpand: true,
        xalign: 0,
      });
      header.append(title);

      const refreshBtn = new Gtk.Button({
        icon_name: "view-refresh-symbolic",
        tooltip_text: "Refresh wallpapers",
      });
      this._signals.connect(refreshBtn, "clicked", () =>
        this._loadWallpapers(),
      );
      header.append(refreshBtn);

      this.append(header);

      const scrolled = new Gtk.ScrolledWindow({
        vexpand: true,
        hexpand: true,
      });

      this._flowBox = new Gtk.FlowBox({
        selection_mode: Gtk.SelectionMode.NONE,
        column_spacing: 12,
        row_spacing: 12,
        homogeneous: true,
        max_children_per_line: 3,
        min_children_per_line: 2,
        margin_start: 6,
        margin_end: 6,
      });

      scrolled.set_child(this._flowBox);
      this.append(scrolled);

      this._statusLabel = new Gtk.Label({
        label: "Loading wallpapers...",
        css_classes: ["dim-label"],
        visible: false,
      });
      this.append(this._statusLabel);
    }

    _loadWallpapers() {
      this._clearGrid();
      this._statusLabel.set_visible(true);
      this._statusLabel.set_label("Loading wallpapers...");

      const wallpaperFolder = this.settingsManager.get("wallpaperFolder");

      try {
        const dir = Gio.File.new_for_path(wallpaperFolder);

        if (!dir.query_exists(null)) {
          this._statusLabel.set_label(
            `Folder not found: ${wallpaperFolder}\nCheck settings to configure wallpaper folder.`,
          );
          return;
        }

        const enumerator = dir.enumerate_children(
          "standard::name,standard::type",
          Gio.FileQueryInfoFlags.NONE,
          null,
        );

        try {
          this._wallpapers = [];
          let fileInfo;

          while ((fileInfo = enumerator.next_file(null))) {
            const name = fileInfo.get_name().toLowerCase();

            if (
              name.endsWith(".jpg") ||
              name.endsWith(".jpeg") ||
              name.endsWith(".png") ||
              name.endsWith(".webp")
            ) {
              const filePath = GLib.build_filenamev([
                wallpaperFolder,
                fileInfo.get_name(),
              ]);

              this._wallpapers.push(filePath);
            }
          }

          if (this._wallpapers.length === 0) {
            this._statusLabel.set_label(
              "No wallpapers found in this folder.\nAdd images (.jpg, .png, .webp) to your wallpaper folder.",
            );
          } else {
            this._statusLabel.set_visible(false);

            this.thumbnailService.syncCache(this._wallpapers, 200, 150);

            this._displayWallpapers();
          }
        } finally {
          enumerator.close(null);
        }
      } catch (e) {
        this._statusLabel.set_label(`Error loading wallpapers: ${e.message}`);
        console.error("Error loading wallpapers:", e);
      }
    }

    _displayWallpapers() {
      this._wallpapers.forEach((path) => {
        const card = this._createWallpaperCard(path);
        this._flowBox.append(card);
      });
    }

    _createWallpaperCard(imagePath) {
      const card = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        css_classes: ["card"],
        width_request: 200,
        height_request: 150,
      });

      const spinner = new Gtk.Spinner({
        spinning: true,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        width_request: 32,
        height_request: 32,
      });
      card.append(spinner);

      const clickGesture = new Gtk.GestureClick();
      clickGesture.connect("pressed", () => {
        this.emit("wallpaper-selected", imagePath);
      });
      card.add_controller(clickGesture);

      const motionController = new Gtk.EventControllerMotion();
      motionController.connect("enter", () => {
        card.set_opacity(0.7);
      });
      motionController.connect("leave", () => {
        card.set_opacity(1.0);
      });
      card.add_controller(motionController);

      this.thumbnailService.getThumbnail(imagePath, 200, 150, (texture) => {
        card.remove(spinner);

        if (texture) {
          const picture = new Gtk.Picture({
            paintable: texture,
            can_shrink: true,
            content_fit: Gtk.ContentFit.COVER,
            hexpand: true,
            vexpand: true,
          });
          card.append(picture);
        } else {
          const errorLabel = new Gtk.Label({
            label: "Error loading image",
            css_classes: ["dim-label"],
          });
          card.append(errorLabel);
        }
      });

      return card;
    }

    _clearGrid() {
      let child = this._flowBox.get_first_child();
      while (child) {
        const next = child.get_next_sibling();
        this._flowBox.remove(child);
        child = next;
      }
    }

    refresh() {
      this._loadWallpapers();
    }
  },
);
