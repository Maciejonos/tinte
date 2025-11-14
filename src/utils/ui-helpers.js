import Gtk from "gi://Gtk?version=4.0";

export function applyCssToWidget(widget, css) {
  const cssProvider = new Gtk.CssProvider();
  cssProvider.load_from_string(css);
  widget
    .get_style_context()
    .add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER);
}

export function removeAllChildren(container) {
  let child = container.get_first_child();
  while (child) {
    const next = child.get_next_sibling();
    container.remove(child);
    child = next;
  }
}
