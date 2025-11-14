import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";
import Gdk from "gi://Gdk?version=4.0";
import GdkPixbuf from "gi://GdkPixbuf";

import { SignalManager } from "../../utils/SignalManager.js";

export const WallpaperSection = GObject.registerClass(
  {
    Signals: {
      "extract-clicked": {},
      "set-wallpaper-clicked": {},
    },
  },
  class WallpaperSection extends Adw.PreferencesGroup {
    _init(settingsManager) {
      super._init({
        visible: false,
      });

      this.settingsManager = settingsManager;
      this._currentWallpaper = null;
      this._spinner = null;
      this._signals = new SignalManager();

      this._buildUI();

      this.connect('unrealize', () => {
        this._signals.disconnectAll();
      });
    }

    _buildUI() {
      const wallpaperRow = new Adw.ActionRow({
        title: "Wallpaper",
        subtitle: "Extract colors from selected image",
      });

      const buttonBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        valign: Gtk.Align.CENTER,
      });

      const imExtractButtonBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
      });

      imExtractButtonBox.append(
        new Gtk.Image({
          icon_name: "color-select-symbolic",
        }),
      );
      imExtractButtonBox.append(
        new Gtk.Label({
          label: "Extract Colors",
        }),
      );

      const backend = this.settingsManager.get("colorBackend");
      this._imExtractButton = new Gtk.Button({
        child: imExtractButtonBox,
        css_classes: ["suggested-action"],
        tooltip_text: "Extract 16 colors from wallpaper using ImageMagick",
        visible: backend === "imagemagick",
      });
      this._signals.connect(this._imExtractButton, "clicked", () =>
        this.emit("extract-clicked"),
      );
      buttonBox.append(this._imExtractButton);

      const setWallpaperButton = new Gtk.Button({
        label: "Set as Wallpaper",
        tooltip_text: "Set this image as your wallpaper",
      });
      this._signals.connect(setWallpaperButton, "clicked", () =>
        this.emit("set-wallpaper-clicked"),
      );
      buttonBox.append(setWallpaperButton);

      this._spinner = new Gtk.Spinner({
        width_request: 24,
        height_request: 24,
        valign: Gtk.Align.CENTER,
        visible: false,
      });
      buttonBox.append(this._spinner);

      wallpaperRow.add_suffix(buttonBox);
      this.add(wallpaperRow);

      this._wallpaperPreview = new Gtk.Picture({
        height_request: 350,
        can_shrink: true,
        content_fit: Gtk.ContentFit.CONTAIN,
        css_classes: ["card"],
        hexpand: true,
        visible: false,
      });
      this.add(this._wallpaperPreview);
    }

    loadWallpaper(path) {
      this._currentWallpaper = path;
      this.set_visible(true);

      try {
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
        const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
        this._wallpaperPreview.set_paintable(texture);
        this._wallpaperPreview.set_visible(true);
      } catch (e) {
        console.error("Failed to load wallpaper:", e.message);
        const file = Gio.File.new_for_path(path);
        this._wallpaperPreview.set_file(file);
        this._wallpaperPreview.set_visible(true);
      }
    }

    getCurrentWallpaper() {
      return this._currentWallpaper;
    }

    setLoading(loading) {
      this._spinner.set_visible(loading);
      if (loading) {
        this._spinner.start();
      } else {
        this._spinner.stop();
      }
    }

    updateButtonVisibility() {
      const backend = this.settingsManager.get("colorBackend");
      this._imExtractButton.set_visible(backend === "imagemagick");
    }

    reset() {
      this._currentWallpaper = null;
      this._wallpaperPreview.set_file(null);
      this._wallpaperPreview.set_visible(false);
      this.set_visible(false);
      this.setLoading(false);
    }
  },
);
