import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { extractColorsFromWallpaperIM } from "../utils/imagemagick-color-extraction.js";
import { runMatugen } from "../utils/matugen-extraction.js";
import { setWallpaper } from "../utils/wallpaper-setter.js";
import { WallpaperSection } from "./palette-editor/WallpaperSection.js";
import { ColorPaletteSection } from "./palette-editor/ColorPaletteSection.js";
import { EmptyState } from "./palette-editor/EmptyState.js";
import { LocalWallpaperBrowser } from "./LocalWallpaperBrowser.js";
import { SignalManager } from "../utils/SignalManager.js";

export const PaletteEditor = GObject.registerClass(
  {
    Signals: {
      "palette-generated": { param_types: [GObject.TYPE_JSOBJECT] },
      "wallpaper-loaded": {},
      "show-message": { param_types: [GObject.TYPE_STRING] },
    },
  },
  class PaletteEditor extends Gtk.Box {
    _init(settingsManager) {
      super._init({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });

      this.settingsManager = settingsManager;
      this.wallpaperPath = null;
      this._showingBrowser = false;
      this._signals = new SignalManager();

      this._initializeUI();

      this.connect('unrealize', () => {
        this._signals.disconnectAll();
      });
    }

    _initializeUI() {
      const viewBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
        margin_top: 12,
        hexpand: true,
      });

      this._emptyState = new EmptyState();
      this._signals.connect(
        this._emptyState,
        "wallpaper-uploaded",
        (_, path) => {
          this.loadWallpaper(path);
        },
      );
      this._signals.connect(this._emptyState, "browse-wallpapers", () => {
        this._toggleBrowser();
      });
      viewBox.append(this._emptyState);

      this._wallpaperBrowser = new LocalWallpaperBrowser(this.settingsManager);
      this._signals.connect(
        this._wallpaperBrowser,
        "wallpaper-selected",
        (_, path) => {
          this.loadWallpaper(path);
        },
      );
      this._wallpaperBrowser.set_visible(false);
      viewBox.append(this._wallpaperBrowser);

      this._wallpaperSection = new WallpaperSection(this.settingsManager);
      this._signals.connect(this._wallpaperSection, "extract-clicked", () => {
        const wallpaper = this._wallpaperSection.getCurrentWallpaper();
        if (wallpaper) {
          this._extractColors(wallpaper);
        }
      });
      this._signals.connect(
        this._wallpaperSection,
        "set-wallpaper-clicked",
        () => {
          const wallpaper = this._wallpaperSection.getCurrentWallpaper();
          if (wallpaper) {
            this._setWallpaper(wallpaper);
          }
        },
      );
      viewBox.append(this._wallpaperSection);

      this._colorPalette = new ColorPaletteSection();
      this._colorPalette.set_visible(false);
      viewBox.append(this._colorPalette);

      this.append(viewBox);
    }

    _toggleBrowser() {
      this._showingBrowser = !this._showingBrowser;
      this._wallpaperBrowser.set_visible(this._showingBrowser);
      this._emptyState.set_visible(!this._showingBrowser);

      if (this._showingBrowser) {
        this._wallpaperBrowser.onBrowserShown();
      }
    }

    loadWallpaper(path) {
      this.wallpaperPath = path;
      this._emptyState.set_visible(false);
      this._wallpaperBrowser.set_visible(false);
      this._showingBrowser = false;
      this._wallpaperSection.loadWallpaper(path);
      this.emit("wallpaper-loaded");
    }

    _extractColors(imagePath) {
      this._wallpaperSection.setLoading(true);
      const backend = this.settingsManager.get("colorBackend");

      if (backend === "matugen") {
        runMatugen(
          imagePath,
          () => {
            this._colorPalette.set_visible(false);
            this.emit("palette-generated", null);
            this._wallpaperSection.setLoading(false);
          },
          (error) => {
            console.error("Error running matugen:", error.message);
            this._wallpaperSection.setLoading(false);
          },
        );
      } else {
        extractColorsFromWallpaperIM(
          imagePath,
          (colors) => {
            this._colorPalette.setPalette(colors);
            this._colorPalette.set_visible(true);
            this.emit("palette-generated", colors);
            this._wallpaperSection.setLoading(false);
          },
          (error) => {
            console.error("Error extracting colors:", error.message);
            this._wallpaperSection.setLoading(false);
          },
        );
      }
    }

    _setWallpaper(imagePath) {
      const backend = this.settingsManager.get("wallpaperBackend");

      if (!backend) {
        this.emit(
          "show-message",
          "Wallpaper backend not configured. Please select a backend (swaybg or hyprpaper) in Settings.",
        );
        return;
      }

      console.log(`Setting wallpaper with ${backend}:`, imagePath);

      setWallpaper(
        imagePath,
        backend,
        () => {
          this.emit("show-message", "Wallpaper set successfully");
        },
        (error) => {
          this.emit("show-message", `Failed to set wallpaper: ${error.message}`);
        },
      );
    }

    reset() {
      this._wallpaperSection.reset();
      this._colorPalette.reset();
      this._colorPalette.set_visible(false);
      this._wallpaperBrowser.set_visible(false);
      this._emptyState.set_visible(true);
      this._showingBrowser = false;
      this.wallpaperPath = null;
    }

    back() {
      this._wallpaperSection.reset();
      this._colorPalette.reset();
      this._colorPalette.set_visible(false);
      this._wallpaperBrowser.set_visible(true);
      this._emptyState.set_visible(false);
      this._showingBrowser = true;
      this._wallpaperBrowser.onBrowserShown();
      this.wallpaperPath = null;
    }
  },
);
