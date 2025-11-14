import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { ColorSwatchGrid } from "../palette/color-swatch-grid.js";

export const ColorPaletteSection = GObject.registerClass(
  {},
  class ColorPaletteSection extends Gtk.Box {
    _init() {
      super._init({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
        margin_top: 12,
      });

      this._buildUI();
    }

    _buildUI() {
      const label = new Gtk.Label({
        label: "Extracted Colors",
        xalign: 0,
        hexpand: true,
        css_classes: ["title-4"],
      });
      this.append(label);

      const subtitle = new Gtk.Label({
        label: "16-color palette extracted from wallpaper",
        xalign: 0,
        margin_bottom: 6,
        css_classes: ["dim-label", "caption"],
      });
      this.append(subtitle);

      this._swatchGrid = new ColorSwatchGrid();
      this.append(this._swatchGrid.widget);
    }

    setPalette(colors) {
      this._swatchGrid.setPalette(colors);
    }

    reset() {
      this._swatchGrid.setPalette([]);
    }
  },
);
