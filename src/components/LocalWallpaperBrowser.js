import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { ThumbnailService } from "../services/thumbnail-service.js";
import { SignalManager } from "../utils/SignalManager.js";

const STATES = {
  LOADING: "loading",
  EMPTY: "empty",
  CONTENT: "content",
};

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

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
      this._hasLoaded = false;

      this._buildUI();

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
        this._loadWallpapersAsync(),
      );
      header.append(refreshBtn);

      this.append(header);

      this._contentStack = new Gtk.Stack({
        vexpand: true,
        hexpand: true,
        transition_type: Gtk.StackTransitionType.CROSSFADE,
      });

      const loadingBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
        spacing: 12,
      });
      this._spinner = new Gtk.Spinner({
        width_request: 48,
        height_request: 48,
      });
      const loadingLabel = new Gtk.Label({
        label: "Caching wallpapers...",
        css_classes: ["dim-label"],
      });
      loadingBox.append(this._spinner);
      loadingBox.append(loadingLabel);
      this._contentStack.add_named(loadingBox, STATES.LOADING);

      const emptyBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
        spacing: 12,
      });
      const emptyIcon = new Gtk.Image({
        icon_name: "folder-symbolic",
        pixel_size: 64,
        css_classes: ["dim-label"],
      });
      const emptyLabel = new Gtk.Label({
        label: "No wallpapers found",
        css_classes: ["dim-label", "title-3"],
      });
      const emptyHint = new Gtk.Label({
        label: "Add images (.jpg, .png, .webp) to your wallpaper folder",
        css_classes: ["dim-label"],
      });
      emptyBox.append(emptyIcon);
      emptyBox.append(emptyLabel);
      emptyBox.append(emptyHint);
      this._contentStack.add_named(emptyBox, STATES.EMPTY);

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
      this._contentStack.add_named(scrolled, STATES.CONTENT);

      this._contentStack.set_visible_child_name(STATES.LOADING);
      this.append(this._contentStack);
    }

    _setState(state) {
      this._contentStack.set_visible_child_name(state);
      state === STATES.LOADING ? this._spinner.start() : this._spinner.stop();
    }

    _isImageFile(filename) {
      const name = filename.toLowerCase();
      return SUPPORTED_EXTENSIONS.some(ext => name.endsWith(ext));
    }

    async _loadWallpapersAsync() {
      this._setState(STATES.LOADING);
      this._clearGrid();

      const wallpaperFolder = this.settingsManager.get("wallpaperFolder");

      try {
        const dir = Gio.File.new_for_path(wallpaperFolder);

        if (!dir.query_exists(null)) {
          this._setState(STATES.EMPTY);
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
            if (this._isImageFile(fileInfo.get_name())) {
              const filePath = GLib.build_filenamev([
                wallpaperFolder,
                fileInfo.get_name(),
              ]);
              this._wallpapers.push(filePath);
            }
          }

          if (this._wallpapers.length === 0) {
            this._setState(STATES.EMPTY);
            return;
          }

          this.thumbnailService.syncCache(this._wallpapers, 200, 150);

          for (const path of this._wallpapers) {
            await this._addWallpaperCardAsync(path);
          }

          this._setState(STATES.CONTENT);
        } finally {
          enumerator.close(null);
        }
      } catch (e) {
        console.error("Error loading wallpapers:", e);
        this._setState(STATES.EMPTY);
      }
    }

    async _addWallpaperCardAsync(imagePath) {
      const card = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        css_classes: ["card"],
        width_request: 200,
        height_request: 150,
      });

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

      const texture = await this.thumbnailService.getThumbnail(imagePath, 200, 150);

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
          halign: Gtk.Align.CENTER,
          valign: Gtk.Align.CENTER,
        });
        card.append(errorLabel);
      }

      this._flowBox.append(card);
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
      this._loadWallpapersAsync();
    }

    onBrowserShown() {
      if (!this._hasLoaded) {
        this._hasLoaded = true;
        this._loadWallpapersAsync();
      }
    }
  },
);
