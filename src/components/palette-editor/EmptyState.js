import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import Gio from "gi://Gio";

import { SignalManager } from "../../utils/SignalManager.js";

export const EmptyState = GObject.registerClass(
  {
    Signals: {
      "wallpaper-uploaded": { param_types: [GObject.TYPE_STRING] },
      "browse-wallpapers": {},
    },
  },
  class EmptyState extends Gtk.Box {
    _init() {
      super._init({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
        margin_top: 24,
        margin_bottom: 24,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
      });

      this._signals = new SignalManager();

      this._buildUI();
      this._setupDragDrop();

      this.connect('unrealize', () => {
        this._signals.disconnectAll();
        if (this._dropTarget) {
          this.remove_controller(this._dropTarget);
          this._dropTarget = null;
        }
      });
    }

    _buildUI() {
      const icon = new Gtk.Image({
        icon_name: "image-x-generic-symbolic",
        pixel_size: 64,
        css_classes: ["dim-label"],
      });
      this.append(icon);

      const title = new Gtk.Label({
        label: "No Wallpaper Loaded",
        css_classes: ["title-2"],
        margin_top: 12,
      });
      this.append(title);

      const subtitle = new Gtk.Label({
        label: "Choose an image to extract colors from",
        css_classes: ["dim-label"],
        margin_bottom: 12,
      });
      this.append(subtitle);

      const buttonsBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        halign: Gtk.Align.CENTER,
      });

      const browseBtn = new Gtk.Button({
        label: "Browse Wallpapers",
        css_classes: ["pill", "suggested-action"],
      });
      this._signals.connect(browseBtn, "clicked", () =>
        this.emit("browse-wallpapers"),
      );
      buttonsBox.append(browseBtn);

      const orLabel = new Gtk.Label({
        label: "or",
        css_classes: ["dim-label"],
      });
      buttonsBox.append(orLabel);

      const uploadBtn = new Gtk.Button({
        label: "Pick File",
        css_classes: ["pill"],
      });
      this._signals.connect(uploadBtn, "clicked", () =>
        this._uploadWallpaper(),
      );
      buttonsBox.append(uploadBtn);

      this.append(buttonsBox);

      const dragHint = new Gtk.Label({
        label: "You can also drag and drop an image here",
        css_classes: ["dim-label", "caption"],
        margin_top: 12,
      });
      this.append(dragHint);
    }

    _setupDragDrop() {
      this._dropTarget = Gtk.DropTarget.new(
        Gdk.FileList.$gtype,
        Gdk.DragAction.COPY,
      );

      this._signals.connect(this._dropTarget, "drop", (target, value, x, y) => {
        const files = value.get_files();
        if (files && files.length > 0) {
          const file = files[0];
          const path = file.get_path();
          if (path) {
            this.emit("wallpaper-uploaded", path);
            return true;
          }
        }
        return false;
      });

      this.add_controller(this._dropTarget);
    }

    _uploadWallpaper() {
      const fileDialog = new Gtk.FileDialog({
        title: "Select Wallpaper",
        modal: true,
      });

      const imageFilter = new Gtk.FileFilter();
      imageFilter.set_name("Image files");
      imageFilter.add_mime_type("image/png");
      imageFilter.add_mime_type("image/jpeg");
      imageFilter.add_mime_type("image/jpg");
      imageFilter.add_mime_type("image/webp");

      const filterList = Gio.ListStore.new(Gtk.FileFilter.$gtype);
      filterList.append(imageFilter);
      fileDialog.set_filters(filterList);

      fileDialog.open(this.get_root(), null, (dialog, result) => {
        try {
          const file = dialog.open_finish(result);
          if (file) {
            const path = file.get_path();
            if (path) {
              this.emit("wallpaper-uploaded", path);
            }
          }
        } catch (e) {
          if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
            console.error("Error selecting wallpaper:", e.message);
          }
        }
      });
    }
  },
);
