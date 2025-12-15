# Tinte

A 16-color palette generator for terminals and Wayland apps.

Similar to [matugen](https://github.com/InioX/matugen) and [pywal](https://github.com/dylanaraps/pywal), but focused on ANSI terminal colors (0-15) using ImageMagick for extraction.

> **Templates:** See [templates/](./templates) for ready-to-use configs (Alacritty, Kitty, Waybar, Hyprland, GTK, etc.)

## Features

- Extract dominant colors from images using ImageMagick
- Generate palette from a single source color
- Simple template variable substitution (`{color0}`, `{background}`, etc.)
- Multiple color formats: hex, rgb, rgba
- Dark and light mode support
- Post-hooks for reloading apps

## Installation

Requires ImageMagick.

#### Arch

```bash
paru -S tinte
```

#### Cargo

```bash
cargo install tinte
```

#### From source

```bash
cargo build --release
cp target/release/tinte ~/.local/bin/
```

## Usage

```
tinte <COMMAND> [OPTIONS]

Commands:
  image <path>    Extract palette from image
  color <hex>     Generate palette from source color

Options:
  -m, --mode <dark|light>     Color scheme mode [default: dark]
  -c, --config <path>         Custom config file
      --dry-run               Preview without writing files
      --show-colors           Print palette to terminal
  -j, --json <hex|rgb|strip>  Output palette as JSON
  -q, --quiet                 Suppress output
  -v, --verbose               Verbose output
```

Examples:

```bash
tinte image ~/wallpaper.png
tinte image ~/wallpaper.png --mode light --show-colors
tinte color "#1a1b26" --dry-run
tinte image ~/wallpaper.png -j hex
```

## Config

Create `~/.config/tinte/config.toml`:

```toml
[config]
wallpaper_cmd = "swaybg -i {path} -m fill"
post_hook = "pkill -SIGUSR2 waybar"

[templates.alacritty]
input_path = "~/.config/tinte/templates/alacritty.toml"
output_path = "~/.config/alacritty/colors.toml"

[templates.kitty]
input_path = "~/.config/tinte/templates/kitty.conf"
output_path = "~/.config/kitty/theme.conf"
post_hook = "pkill -SIGUSR1 kitty"
```

## Templates

Templates use simple variable substitution:

```
{background}        # #1a1b26
{foreground}        # #c0caf5
{color0} - {color15}

{color1.strip}      # 1a1b26 (no #)
{color1.rgb}        # 26, 27, 38
{color1.rgba}       # rgba(26, 27, 38, 1)
{color1.rgba:0.5}   # rgba(26, 27, 38, 0.5)
```

## Color Mapping

| Index | Name       | Role                   |
|-------|------------|------------------------|
| 0     | color0     | background / black     |
| 1     | color1     | red                    |
| 2     | color2     | green                  |
| 3     | color3     | yellow                 |
| 4     | color4     | blue                   |
| 5     | color5     | magenta                |
| 6     | color6     | cyan                   |
| 7     | color7     | white                  |
| 8-15  | color8-15  | bright variants        |

## Related Projects

- [matugen](https://github.com/InioX/matugen) - Material You color generation
- [pywal](https://github.com/dylanaraps/pywal) - Multiple backends, default theme files
- [wpgtk](https://github.com/deviantfero/wpgtk) - GUI with more features

## License

MIT
