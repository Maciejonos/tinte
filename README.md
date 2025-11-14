# Tinte

Wallpaper utility and theme generator for Wayland. Fork of [aether](https://github.com/bjarneo/aether) that is not limited to Omarchy.

## Features

- **Color extraction** - ImageMagick or Matugen backends
- **Wallpaper setter** - swaybg and hyprpaper support
- **Theme generation** - 15+ app configs from single wallpaper
- **Caching** - thumbnails and color palettes

## Install

```bash
paru -S tinte
```

**Dependencies:** `gjs` `gtk4` `libadwaita` `libsoup3` `imagemagick` `matugen`

## Usage

1. Select wallpaper or drag & drop
2. Extract colors or set wallpaper
3. Apply theme or export

## Settings

- Color backend - ImageMagick or Matugen
- Wallpaper backend - swaybg or hyprpaper
- Folder paths and posthook script

### Defaults

- Backend - ImageMagick
- Wallpaper Backend - None
- Wallpaper Folder - `~/Pictures/wallpapers/`
- Posthook Script - None
- Export Theme Location - `~/.config/tinte/themes/`
- Apply Theme Location - `~/.config/themes/tinte/`

You can also specify all options by editing `~/.config/tinte/settings.json`:

```json
{
  "wallpaperFolder": "/home/user/Pictures/wallpapers",
  "posthookScript": "your-script.sh",
  "exportThemeLocation": "/home/user/.config/tinte/themes",
  "applyThemeLocation": "/home/user/.config/themes/tinte",
  "colorBackend": "imagemagick",
  "wallpaperBackend": "swaybg"
}
```

## Templates

Generates configs for: `alacritty` `btop` `ghostty` `gtk` `hyprland` `hyprlock` `kitty` `mako` `neovim` `swayosd` `walker` `waybar` `wofi`

Templates in `templates/` directory.

**Matugen:** Must be configured manually at `~/.config/matugen/config.toml` and `~/.config/matugen/templates/`. Examples in `matugen_templates/`.

## License

MIT

## Credits

Thanks to bjarneo for [aether](https://github.com/bjarneo/aether).
