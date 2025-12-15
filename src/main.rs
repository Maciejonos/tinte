use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::process::Command;

use tinte::color::{Palette, Rgb};
use tinte::config::{expand_path, Config};
use tinte::extraction::extract_palette;
use tinte::template::process_templates;

#[derive(Parser)]
#[command(name = "tinte")]
#[command(about = "16-color palette generator for terminal and Wayland apps")]
#[command(version)]
struct Cli {
	#[command(subcommand)]
	command: Commands,

	#[arg(short, long, global = true)]
	config: Option<PathBuf>,

	#[arg(short, long, default_value = "dark", global = true)]
	mode: Mode,

	#[arg(short, long, global = true)]
	verbose: bool,

	#[arg(short, long, global = true)]
	quiet: bool,

	#[arg(long, global = true)]
	dry_run: bool,

	#[arg(long, global = true)]
	show_colors: bool,

	#[arg(short, long, global = true)]
	json: Option<JsonFormat>,
}

#[derive(Clone, Copy, clap::ValueEnum)]
enum Mode {
	Dark,
	Light,
}

#[derive(Clone, Copy, clap::ValueEnum)]
enum JsonFormat {
	Hex,
	Rgb,
	Strip,
}

#[derive(Subcommand)]
enum Commands {
	Image { path: PathBuf },
	Color { hex: String },
}

fn main() -> Result<()> {
	let cli = Cli::parse();
	let light_mode = matches!(cli.mode, Mode::Light);

	let config = Config::load(cli.config.as_ref())?;

	match cli.command {
		Commands::Image { path } => {
			let path_str = path.to_str()
				.ok_or_else(|| anyhow::anyhow!("Invalid path: {:?}", path))?;
			let path = expand_path(path_str);

			if !cli.quiet {
				println!("Extracting colors from: {}", path.display());
			}

			let palette = extract_palette(&path, light_mode)?;

			if cli.show_colors {
				print_palette(&palette);
			}

			if let Some(format) = cli.json {
				print_json(&palette, format);
			}

			if !config.templates.is_empty() {
				process_templates(&config, &palette, cli.dry_run)?;
			}

			if !cli.dry_run && let Some(ref cmd) = config.config.wallpaper_cmd {
				let expanded = path.to_str()
					.ok_or_else(|| anyhow::anyhow!("Invalid expanded path: {:?}", path))?;
				let cmd = cmd.replace("{path}", expanded);
				if cli.verbose {
					println!("Setting wallpaper: {}", cmd);
				}
				Command::new("sh").arg("-c").arg(&cmd).status()?;
			}
		}

		Commands::Color { hex } => {
			let source = Rgb::from_hex(&hex)
				.ok_or_else(|| anyhow::anyhow!("Invalid hex color: {}", hex))?;

			if !cli.quiet {
				println!("Generating palette from: {}", source.to_hex());
			}

			let palette = generate_from_color(source, light_mode);

			if cli.show_colors {
				print_palette(&palette);
			}

			if let Some(format) = cli.json {
				print_json(&palette, format);
			}

			if !config.templates.is_empty() {
				process_templates(&config, &palette, cli.dry_run)?;
			}
		}
	}

	Ok(())
}

fn print_palette(palette: &Palette) {
	println!("\nPalette:");
	for (i, color) in palette.colors.iter().enumerate() {
		let label = match i {
			0 => "background",
			1 => "red      ",
			2 => "green    ",
			3 => "yellow   ",
			4 => "blue     ",
			5 => "magenta  ",
			6 => "cyan     ",
			7 => "white    ",
			8 => "brblack  ",
			9 => "brred    ",
			10 => "brgreen  ",
			11 => "bryellow ",
			12 => "brblue   ",
			13 => "brmagenta",
			14 => "brcyan   ",
			15 => "brwhite  ",
			_ => "         ",
		};
		println!(
			"  {:2} {} {} \x1b[48;2;{};{};{}m    \x1b[0m",
			i, label, color.to_hex(), color.r, color.g, color.b
		);
	}
	println!();
}

fn print_json(palette: &Palette, format: JsonFormat) {
	println!("{{");
	for (i, color) in palette.colors.iter().enumerate() {
		let value = match format {
			JsonFormat::Hex => color.to_hex(),
			JsonFormat::Strip => color.to_hex_strip(),
			JsonFormat::Rgb => color.to_rgb_string(),
		};
		let comma = if i < 15 { "," } else { "" };
		match i {
			0 => println!("  \"background\": \"{}\"{}", value, comma),
			15 => println!("  \"foreground\": \"{}\"{}", value, comma),
			_ => println!("  \"color{}\": \"{}\"{}", i, value, comma),
		}
	}
	println!("}}");
}

fn generate_from_color(source: Rgb, light_mode: bool) -> Palette {
	use tinte::color::Hsl;

	let hsl = source.to_hsl();
	let bg_l = if light_mode { 0.92 } else { 0.08 };
	let fg_l = if light_mode { 0.15 } else { 0.85 };
	let color_l = if light_mode { 0.45 } else { 0.55 };
	let bright_l = if light_mode { 0.35 } else { 0.65 };

	let background = Hsl::new(hsl.h, hsl.s.min(0.15), bg_l).to_rgb();
	let foreground = Hsl::new(hsl.h, hsl.s.min(0.1), fg_l).to_rgb();
	let bright_black = Hsl::new(hsl.h, hsl.s.min(0.15), if light_mode { 0.75 } else { 0.25 }).to_rgb();

	let hue_offsets = [0.0, 120.0, 60.0, 240.0, 300.0, 180.0];
	let colors: Vec<Rgb> = hue_offsets
		.iter()
		.map(|offset| Hsl::new((hsl.h + offset) % 360.0, 0.6, color_l).to_rgb())
		.collect();
	let bright: Vec<Rgb> = hue_offsets
		.iter()
		.map(|offset| Hsl::new((hsl.h + offset) % 360.0, 0.7, bright_l).to_rgb())
		.collect();

	Palette::new([
		background,
		colors[0],
		colors[1],
		colors[2],
		colors[3],
		colors[4],
		colors[5],
		foreground,
		bright_black,
		bright[0],
		bright[1],
		bright[2],
		bright[3],
		bright[4],
		bright[5],
		foreground,
	])
}
