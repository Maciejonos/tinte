use crate::color::{Hsl, Palette, Rgb};
use anyhow::{Context, Result};
use std::collections::HashSet;
use std::path::Path;
use std::process::Command;

const DOMINANT_COLORS: usize = 24;
const MONOCHROME_SAT_THRESHOLD: f64 = 15.0;
const MONOCHROME_RATIO: f64 = 0.7;
const LOW_DIVERSITY_RATIO: f64 = 0.6;
const SIMILAR_HUE_RANGE: f64 = 30.0;
const SIMILAR_LIGHTNESS_RANGE: f64 = 20.0;
const MIN_BG_LIGHTNESS_DARK: f64 = 8.0;
const MAX_BG_LIGHTNESS_LIGHT: f64 = 92.0;
const MIN_FG_CONTRAST: f64 = 40.0;
const TOO_DARK: f64 = 20.0;
const TOO_BRIGHT: f64 = 85.0;
const MONOCHROME_SAT: f64 = 5.0;
const SUBTLE_SAT: f64 = 28.0;
const BRIGHT_L_BOOST: f64 = 18.0;
const BRIGHT_S_BOOST: f64 = 1.25;
const MIN_L_ON_DARK_BG: f64 = 55.0;
const MAX_L_ON_LIGHT_BG: f64 = 45.0;
const VERY_DARK_BG: f64 = 20.0;
const VERY_LIGHT_BG: f64 = 80.0;

const ANSI_HUES: [f64; 6] = [0.0, 120.0, 60.0, 240.0, 300.0, 180.0];

pub fn extract_palette(image_path: &Path, light_mode: bool) -> Result<Palette> {
	let resolved = image_path
		.canonicalize()
		.unwrap_or_else(|_| image_path.to_path_buf());

	let colors = extract_with_imagemagick(&resolved)?;

	if colors.is_empty() {
		return Ok(Palette::default());
	}

	let hsl_colors: Vec<Hsl> = colors.iter().map(|c| c.to_hsl()).collect();

	let palette = if is_monochrome(&hsl_colors) {
		generate_monochrome_palette(&colors, &hsl_colors, light_mode)
	} else if has_low_diversity(&hsl_colors) {
		generate_subtle_palette(&colors, &hsl_colors, light_mode)
	} else {
		generate_chromatic_palette(&colors, &hsl_colors, light_mode)
	};

	Ok(palette)
}

fn extract_with_imagemagick(path: &Path) -> Result<Vec<Rgb>> {
	let output = Command::new("magick")
		.arg(path)
		.args(["-scale", "800x600>", "-colors", &DOMINANT_COLORS.to_string(), "-depth", "8", "-format", "%c", "histogram:info:-"])
		.output()
		.or_else(|_| {
			Command::new("convert")
				.arg(path)
				.args(["-scale", "800x600>", "-colors", &DOMINANT_COLORS.to_string(), "-depth", "8", "-format", "%c", "histogram:info:-"])
				.output()
		})
		.context("Failed to run ImageMagick")?;

	if !output.status.success() {
		anyhow::bail!("ImageMagick failed: {}", String::from_utf8_lossy(&output.stderr));
	}

	let stdout = String::from_utf8_lossy(&output.stdout);
	let mut colors = Vec::new();

	for line in stdout.lines() {
		if let Some(color) = parse_histogram_line(line) {
			colors.push(color);
		}
	}

	Ok(colors)
}

fn parse_histogram_line(line: &str) -> Option<Rgb> {
	let line = line.trim();
	let hex_start = line.find('#')?;
	if hex_start + 7 > line.len() {
		return None;
	}
	let hex = &line[hex_start + 1..hex_start + 7];
	Rgb::from_hex(hex)
}

fn is_monochrome(colors: &[Hsl]) -> bool {
	let low_sat = colors.iter().filter(|c| c.s * 100.0 < MONOCHROME_SAT_THRESHOLD).count();
	(low_sat as f64 / colors.len() as f64) > MONOCHROME_RATIO
}

fn has_low_diversity(colors: &[Hsl]) -> bool {
	let chromatic: Vec<&Hsl> = colors.iter().filter(|c| c.s * 100.0 >= MONOCHROME_SAT_THRESHOLD).collect();

	if chromatic.len() < 2 {
		return true;
	}

	let mut similar = 0;
	let mut total = 0;

	for i in 0..chromatic.len() {
		for j in (i + 1)..chromatic.len() {
			total += 1;
			let hue_diff = hue_distance(chromatic[i].h, chromatic[j].h);
			let l_diff = (chromatic[i].l * 100.0 - chromatic[j].l * 100.0).abs();

			if hue_diff < SIMILAR_HUE_RANGE && l_diff < SIMILAR_LIGHTNESS_RANGE {
				similar += 1;
			}
		}
	}

	if total == 0 {
		return true;
	}

	(similar as f64 / total as f64) > LOW_DIVERSITY_RATIO
}

fn hue_distance(h1: f64, h2: f64) -> f64 {
	let diff = (h1 - h2).abs();
	if diff > 180.0 { 360.0 - diff } else { diff }
}

fn generate_chromatic_palette(colors: &[Rgb], hsl_colors: &[Hsl], light_mode: bool) -> Palette {
	let mut used: HashSet<usize> = HashSet::new();

	let (bg_idx, bg) = find_background(colors, hsl_colors, light_mode);
	used.insert(bg_idx);

	let (fg_idx, fg) = find_foreground(colors, hsl_colors, &bg, light_mode, &used);
	used.insert(fg_idx);

	let bg_hsl = bg.to_hsl();

	let mut ansi = [Rgb::new(128, 128, 128); 6];
	for (i, &target_hue) in ANSI_HUES.iter().enumerate() {
		if let Some((idx, color)) = find_best_color_match(colors, hsl_colors, target_hue, &used) {
			ansi[i] = color;
			used.insert(idx);
		} else {
			let l = if light_mode { 45.0 } else { 55.0 };
			ansi[i] = Hsl::new(target_hue, 0.5, l / 100.0).to_rgb();
		}
	}

	normalize_brightness(&mut ansi, &bg, light_mode);

	let bright_black = {
		let l = if light_mode {
			(bg_hsl.l * 100.0 - 15.0).max(0.0)
		} else {
			(bg_hsl.l * 100.0 + 15.0).min(100.0)
		};
		Hsl::new(bg_hsl.h, bg_hsl.s * 0.5, l / 100.0).to_rgb()
	};

	let mut bright = make_bright(&ansi, light_mode);
	normalize_brightness(&mut bright, &bg, light_mode);

	Palette::new([
		bg, ansi[0], ansi[1], ansi[2], ansi[3], ansi[4], ansi[5], fg,
		bright_black, bright[0], bright[1], bright[2], bright[3], bright[4], bright[5], fg,
	])
}

fn generate_monochrome_palette(colors: &[Rgb], hsl_colors: &[Hsl], light_mode: bool) -> Palette {
	let (darkest_idx, lightest_idx) = find_lightness_extremes(hsl_colors);
	let darkest = &hsl_colors[darkest_idx];
	let lightest = &hsl_colors[lightest_idx];
	let base_hue = darkest.h;

	let (bg, fg) = if light_mode {
		(colors[lightest_idx], colors[darkest_idx])
	} else {
		(colors[darkest_idx], colors[lightest_idx])
	};

	let (start_l, end_l) = if light_mode {
		let s = (darkest.l * 100.0 + 10.0).min(lightest.l * 100.0 - 10.0);
		let e = (darkest.l * 100.0 + 40.0).min(lightest.l * 100.0 - 10.0);
		if e <= s { (darkest.l * 100.0, lightest.l * 100.0) } else { (s, e) }
	} else {
		let s = (darkest.l * 100.0 + 30.0).max(lightest.l * 100.0 - 40.0);
		let e = lightest.l * 100.0 - 10.0;
		if e <= s { (darkest.l * 100.0 + 10.0, lightest.l * 100.0) } else { (s, e) }
	};

	let range = (end_l - start_l).max(15.0);
	let step = range / 5.0;

	let mut ansi = [Rgb::new(128, 128, 128); 6];
	for (i, slot) in ansi.iter_mut().enumerate() {
		let l = (start_l + i as f64 * step).clamp(0.0, 100.0);
		*slot = Hsl::new(base_hue, MONOCHROME_SAT / 100.0, l / 100.0).to_rgb();
	}

	let bright_black = {
		let l = if light_mode {
			(darkest.l * 100.0 + 5.0).max(0.0)
		} else {
			(lightest.l * 100.0 - 25.0).min(100.0)
		};
		Hsl::new(base_hue, MONOCHROME_SAT / 200.0, l / 100.0).to_rgb()
	};

	let mut bright = [Rgb::new(0, 0, 0); 6];
	for (i, slot) in bright.iter_mut().enumerate() {
		let base_l = start_l + i as f64 * step;
		let l = if light_mode {
			(base_l - 10.0).clamp(0.0, 100.0)
		} else {
			(base_l + 10.0).clamp(0.0, 100.0)
		};
		*slot = Hsl::new(base_hue, MONOCHROME_SAT / 100.0, l / 100.0).to_rgb();
	}

	let bright_white = {
		let l = if light_mode {
			(darkest.l * 100.0 - 5.0).max(0.0)
		} else {
			(lightest.l * 100.0 + 5.0).min(100.0)
		};
		Hsl::new(base_hue, 0.02, l / 100.0).to_rgb()
	};

	Palette::new([
		bg, ansi[0], ansi[1], ansi[2], ansi[3], ansi[4], ansi[5], fg,
		bright_black, bright[0], bright[1], bright[2], bright[3], bright[4], bright[5], bright_white,
	])
}

fn generate_subtle_palette(colors: &[Rgb], hsl_colors: &[Hsl], light_mode: bool) -> Palette {
	let (darkest_idx, lightest_idx) = find_lightness_extremes(hsl_colors);
	let darkest = &hsl_colors[darkest_idx];
	let lightest = &hsl_colors[lightest_idx];

	let chromatic: Vec<&Hsl> = hsl_colors.iter().filter(|c| c.s * 100.0 >= MONOCHROME_SAT_THRESHOLD).collect();
	let avg_hue = if chromatic.is_empty() {
		darkest.h
	} else {
		chromatic.iter().map(|c| c.h).sum::<f64>() / chromatic.len() as f64
	};

	let (bg, fg) = if light_mode {
		(colors[lightest_idx], colors[darkest_idx])
	} else {
		(colors[darkest_idx], colors[lightest_idx])
	};

	let mut ansi = [Rgb::new(128, 128, 128); 6];
	for i in 0..6 {
		let l = 50.0 + (i as f64 - 2.5) * 4.0;
		ansi[i] = Hsl::new(ANSI_HUES[i], SUBTLE_SAT / 100.0, l / 100.0).to_rgb();
	}

	let bright_black = {
		let l = if light_mode {
			(lightest.l * 100.0 - 15.0).max(0.0)
		} else {
			(darkest.l * 100.0 + 15.0).min(100.0)
		};
		Hsl::new(avg_hue, SUBTLE_SAT / 200.0, l / 100.0).to_rgb()
	};

	let bright_sat = SUBTLE_SAT + 8.0;
	let mut bright = [Rgb::new(0, 0, 0); 6];
	for i in 0..6 {
		let base_l = 50.0 + (i as f64 - 2.5) * 4.0;
		let l = if light_mode {
			(base_l - 8.0).clamp(0.0, 100.0)
		} else {
			(base_l + 8.0).clamp(0.0, 100.0)
		};
		bright[i] = Hsl::new(ANSI_HUES[i], bright_sat / 100.0, l / 100.0).to_rgb();
	}

	let bright_white = {
		let l = if light_mode {
			(darkest.l * 100.0 - 5.0).max(0.0)
		} else {
			(lightest.l * 100.0 + 5.0).min(100.0)
		};
		Hsl::new(avg_hue, SUBTLE_SAT * 0.3 / 100.0, l / 100.0).to_rgb()
	};

	Palette::new([
		bg, ansi[0], ansi[1], ansi[2], ansi[3], ansi[4], ansi[5], fg,
		bright_black, bright[0], bright[1], bright[2], bright[3], bright[4], bright[5], bright_white,
	])
}

fn find_lightness_extremes(colors: &[Hsl]) -> (usize, usize) {
	let mut darkest = 0;
	let mut lightest = 0;
	let mut min_l = f64::MAX;
	let mut max_l = f64::MIN;

	for (i, c) in colors.iter().enumerate() {
		if c.l < min_l {
			min_l = c.l;
			darkest = i;
		}
		if c.l > max_l {
			max_l = c.l;
			lightest = i;
		}
	}

	(darkest, lightest)
}

fn find_background(colors: &[Rgb], hsl_colors: &[Hsl], light_mode: bool) -> (usize, Rgb) {
	let mut best_idx = 0;
	let mut best_l = if light_mode { 0.0 } else { 100.0 };

	for (i, hsl) in hsl_colors.iter().enumerate() {
		let l = hsl.l * 100.0;
		if light_mode {
			if l <= MAX_BG_LIGHTNESS_LIGHT && l > best_l {
				best_l = l;
				best_idx = i;
			}
		} else if l >= MIN_BG_LIGHTNESS_DARK && l < best_l {
			best_l = l;
			best_idx = i;
		}
	}

	let mut bg = colors[best_idx];
	let hsl = bg.to_hsl();
	let l = if light_mode {
		(hsl.l * 100.0).clamp(MAX_BG_LIGHTNESS_LIGHT - 10.0, MAX_BG_LIGHTNESS_LIGHT)
	} else {
		(hsl.l * 100.0).clamp(MIN_BG_LIGHTNESS_DARK, MIN_BG_LIGHTNESS_DARK + 6.0)
	};
	bg = Hsl::new(hsl.h, hsl.s.min(0.15), l / 100.0).to_rgb();

	(best_idx, bg)
}

fn find_foreground(colors: &[Rgb], hsl_colors: &[Hsl], bg: &Rgb, light_mode: bool, used: &HashSet<usize>) -> (usize, Rgb) {
	let bg_l = bg.to_hsl().l * 100.0;
	let mut best_idx = 0;
	let mut best_l = if light_mode { 100.0 } else { 0.0 };

	for (i, hsl) in hsl_colors.iter().enumerate() {
		if used.contains(&i) {
			continue;
		}
		let l = hsl.l * 100.0;
		if light_mode {
			if l < best_l {
				best_l = l;
				best_idx = i;
			}
		} else if l > best_l {
			best_l = l;
			best_idx = i;
		}
	}

	let mut fg = colors[best_idx];
	let fg_hsl = fg.to_hsl();
	let contrast = (fg_hsl.l * 100.0 - bg_l).abs();

	if contrast < MIN_FG_CONTRAST {
		let target_l = if light_mode {
			(bg_l - MIN_FG_CONTRAST).max(0.0)
		} else {
			(bg_l + MIN_FG_CONTRAST).min(100.0)
		};
		fg = Hsl::new(fg_hsl.h, fg_hsl.s.min(0.1), target_l / 100.0).to_rgb();
	}

	(best_idx, fg)
}

fn find_best_color_match(colors: &[Rgb], hsl_colors: &[Hsl], target_hue: f64, used: &HashSet<usize>) -> Option<(usize, Rgb)> {
	let mut best_idx = None;
	let mut best_score = f64::MAX;

	for (i, hsl) in hsl_colors.iter().enumerate() {
		if used.contains(&i) {
			continue;
		}

		let hue_diff = hue_distance(hsl.h, target_hue);
		let s = hsl.s * 100.0;
		let l = hsl.l * 100.0;

		let sat_penalty = if s < MONOCHROME_SAT_THRESHOLD { 50.0 } else { 0.0 };
		let l_penalty = if !(TOO_DARK..=TOO_BRIGHT).contains(&l) { 10.0 } else { 0.0 };

		let score = hue_diff * 3.0 + sat_penalty + l_penalty;

		if score < best_score {
			best_score = score;
			best_idx = Some(i);
		}
	}

	best_idx.map(|i| (i, colors[i]))
}

fn make_bright(colors: &[Rgb; 6], light_mode: bool) -> [Rgb; 6] {
	let mut result = [Rgb::new(0, 0, 0); 6];
	for (i, color) in colors.iter().enumerate() {
		let hsl = color.to_hsl();
		let l = if light_mode {
			(hsl.l * 100.0 - BRIGHT_L_BOOST).clamp(0.0, 100.0)
		} else {
			(hsl.l * 100.0 + BRIGHT_L_BOOST).clamp(0.0, 100.0)
		};
		let s = (hsl.s * BRIGHT_S_BOOST).min(1.0);
		result[i] = Hsl::new(hsl.h, s, l / 100.0).to_rgb();
	}
	result
}

fn normalize_brightness(colors: &mut [Rgb; 6], bg: &Rgb, light_mode: bool) {
	let bg_l = bg.to_hsl().l * 100.0;

	for color in colors.iter_mut() {
		let hsl = color.to_hsl();
		let l = hsl.l * 100.0;

		let new_l = if !light_mode && bg_l < VERY_DARK_BG && l < MIN_L_ON_DARK_BG {
			MIN_L_ON_DARK_BG
		} else if light_mode && bg_l > VERY_LIGHT_BG && l > MAX_L_ON_LIGHT_BG {
			MAX_L_ON_LIGHT_BG
		} else {
			l
		};

		if (new_l - l).abs() > 0.1 {
			*color = Hsl::new(hsl.h, hsl.s, new_l / 100.0).to_rgb();
		}
	}
}
