use crate::color::{Palette, Rgb};
use crate::config::{expand_path, Config};
use anyhow::{Context, Result};
use std::fs;
use std::process::Command;

pub fn process_templates(config: &Config, palette: &Palette, dry_run: bool) -> Result<()> {
	for (name, template) in &config.templates {
		let input = expand_path(&template.input_path);
		let output = expand_path(&template.output_path);

		if !input.exists() {
			eprintln!("Template not found: {} ({})", name, input.display());
			continue;
		}

		let content = fs::read_to_string(&input)
			.with_context(|| format!("Failed to read template: {}", input.display()))?;

		let processed = replace_variables(&content, palette);

		if dry_run {
			println!("[dry-run] Would write: {}", output.display());
		} else {
			if let Some(parent) = output.parent() {
				fs::create_dir_all(parent)?;
			}
			fs::write(&output, &processed)
				.with_context(|| format!("Failed to write: {}", output.display()))?;
			println!("Wrote: {}", output.display());

			if let Some(hook) = &template.post_hook {
				run_hook(hook)?;
			}
		}
	}

	if !dry_run && let Some(hook) = &config.config.post_hook {
		run_hook(hook)?;
	}

	Ok(())
}

fn replace_variables(content: &str, palette: &Palette) -> String {
	let mut result = content.to_string();

	let vars: [(&str, Rgb); 25] = [
		("background", palette.background()),
		("foreground", palette.foreground()),
		("color0", palette.colors[0]),
		("color1", palette.colors[1]),
		("color2", palette.colors[2]),
		("color3", palette.colors[3]),
		("color4", palette.colors[4]),
		("color5", palette.colors[5]),
		("color6", palette.colors[6]),
		("color7", palette.colors[7]),
		("color8", palette.colors[8]),
		("color9", palette.colors[9]),
		("color10", palette.colors[10]),
		("color11", palette.colors[11]),
		("color12", palette.colors[12]),
		("color13", palette.colors[13]),
		("color14", palette.colors[14]),
		("color15", palette.colors[15]),
		("accent", palette.accent),
		("accent_dim", palette.accent_dim),
		("accent_bright", palette.accent_bright),
		("secondary", palette.secondary),
		("surface", palette.surface),
		("on_accent", palette.on_accent),
		("on_surface", palette.on_surface),
	];

	for (name, color) in vars {
		result = result.replace(&format!("{{{}.strip}}", name), &color.to_hex_strip());
		result = result.replace(&format!("{{{}.rgb}}", name), &color.to_rgb_string());
		result = result.replace(&format!("{{{}.rgba}}", name), &color.to_rgba_string(1.0));

		let rgba_pattern = format!("{{{}.rgba:", name);
		while let Some(start) = result.find(&rgba_pattern) {
			let after_pattern = start + rgba_pattern.len();
			if let Some(end) = result[after_pattern..].find('}') {
				let alpha_str = &result[after_pattern..after_pattern + end];
				if let Ok(alpha) = alpha_str.trim().parse::<f64>() {
					let full_pattern = format!("{{{}.rgba:{}}}", name, alpha_str);
					result = result.replace(&full_pattern, &color.to_rgba_string(alpha));
				} else {
					break;
				}
			} else {
				break;
			}
		}

		result = result.replace(&format!("{{{}}}", name), &color.to_hex());
	}

	result
}

fn run_hook(cmd: &str) -> Result<()> {
	println!("Running hook: {}", cmd);
	Command::new("sh")
		.arg("-c")
		.arg(cmd)
		.status()
		.with_context(|| format!("Failed to run hook: {}", cmd))?;
	Ok(())
}
