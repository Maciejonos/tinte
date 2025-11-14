# Tinte

Wallpaper utility and theme generator for Wayland. Fork of [aether](https://github.com/bjarneo/aether) that is not limited to Omarchy.
<table>
  <tr>
    <td>
      <img
        src="https://github.com/user-attachments/assets/84e18ac3-05c3-400b-90e5-c0def0e1780e"
        alt="1"
        width="400"
      />
    </td>
    <td>
      <img
        src="https://github.com/user-attachments/assets/cb13dde7-961e-4a07-b0c9-d98666969d7d"
        alt="2"
        width="400"
      />
    </td>
  </tr>
  <tr>
    <td>
      <img
        src="https://github.com/user-attachments/assets/a1bb178c-cfac-4fa1-afc2-9302a47d645c"
        alt="3"
        width="400"
      />
    </td>
    <td>
      <img
        src="https://github.com/user-attachments/assets/180a7501-857d-4af2-9b63-5b1c6425e0c0"
        alt="4"
        width="400"
      />
    </td>
  </tr>
</table>

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

Thanks to bjarneo for [aether](https://github.com/bjarneo/aether) and awesome neovim plugins!
