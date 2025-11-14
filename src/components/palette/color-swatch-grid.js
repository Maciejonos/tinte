import Gtk from "gi://Gtk?version=4.0";
import { applyCssToWidget, removeAllChildren } from "../../utils/ui-helpers.js";

const ANSI_COLOR_NAMES = [
  "Black (0)",
  "Red (1)",
  "Green (2)",
  "Yellow (3)",
  "Blue (4)",
  "Magenta (5)",
  "Cyan (6)",
  "White (7)",
  "Bright Black (8)",
  "Bright Red (9)",
  "Bright Green (10)",
  "Bright Yellow (11)",
  "Bright Blue (12)",
  "Bright Magenta (13)",
  "Bright Cyan (14)",
  "Bright White (15)",
];

export class ColorSwatchGrid {
  constructor() {
    this._palette = [];

    this.widget = new Gtk.FlowBox({
      selection_mode: Gtk.SelectionMode.NONE,
      column_spacing: 4,
      row_spacing: 4,
      homogeneous: true,
      max_children_per_line: 8,
      min_children_per_line: 8,
      hexpand: true,
    });
  }

  setPalette(colors) {
    this._palette = colors;
    this._render();
  }

  _render() {
    removeAllChildren(this.widget);

    this._palette.forEach((color, index) => {
      const swatch = this._createColorSwatch(color, index);
      this.widget.append(swatch);
    });
  }

  _createColorSwatch(color, index) {
    const colorBox = new Gtk.Box({
      width_request: 35,
      height_request: 35,
      css_classes: ["color-swatch"],
      tooltip_text: `${ANSI_COLOR_NAMES[index]}\n${color}`,
    });

    const css = `
            .color-swatch {
                background-color: ${color};
                border-radius: 0px;
                border: 2px solid alpha(@borders, 0.3);
                min-width: 35px;
                min-height: 35px;
            }
        `;

    applyCssToWidget(colorBox, css);

    return colorBox;
  }
}
