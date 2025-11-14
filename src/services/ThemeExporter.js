import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";

export class ThemeExporter {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
  }

  async export(colorRoles, wallpaperPath) {
    const themeName = await this._promptThemeName();
    if (!themeName) {
      throw new Error("Theme name is required");
    }

    const { ConfigWriter } = await import("../utils/ConfigWriter.js");
    const configWriter = new ConfigWriter(this.settingsManager);

    const success = configWriter.exportTheme(
      themeName,
      colorRoles,
      wallpaperPath,
    );

    if (!success) {
      throw new Error("Export failed");
    }

    const exportBase = this.settingsManager.get("exportThemeLocation");
    const exportPath = GLib.build_filenamev([exportBase, themeName]);
    console.log(`Theme exported to: ${exportPath}`);
    return exportPath;
  }

  async _promptThemeName() {
    return new Promise((resolve, reject) => {
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      const defaultName = `tinte-${timestamp}`;

      const dialog = new Adw.MessageDialog({
        heading: "Export Theme",
        body: "Enter a name for your theme:",
        modal: true,
      });

      dialog.add_response("cancel", "Cancel");
      dialog.add_response("export", "Export");
      dialog.set_response_appearance(
        "export",
        Adw.ResponseAppearance.SUGGESTED,
      );
      dialog.set_default_response("export");
      dialog.set_close_response("cancel");

      const entry = new Gtk.Entry({
        text: defaultName,
        placeholder_text: "theme-name",
        max_width_chars: 30,
      });
      entry.set_activates_default(true);

      const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12,
      });
      box.append(entry);

      dialog.set_extra_child(box);

      dialog.connect("response", (_, response) => {
        if (response === "export") {
          const themeName = entry.get_text().trim();
          if (themeName) {
            resolve(themeName);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
        dialog.close();
      });

      dialog.present();
    });
  }
}
