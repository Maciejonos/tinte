use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rgb {
	pub r: u8,
	pub g: u8,
	pub b: u8,
}

#[derive(Debug, Clone, Copy)]
pub struct Hsl {
	pub h: f64,
	pub s: f64,
	pub l: f64,
}

impl Rgb {
	pub fn new(r: u8, g: u8, b: u8) -> Self {
		Self { r, g, b }
	}

	pub fn from_hex(hex: &str) -> Option<Self> {
		let hex = hex.trim_start_matches('#');
		if hex.len() != 6 {
			return None;
		}
		let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
		let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
		let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
		Some(Self { r, g, b })
	}

	pub fn to_hex(self) -> String {
		format!("#{:02x}{:02x}{:02x}", self.r, self.g, self.b)
	}

	pub fn to_hex_strip(self) -> String {
		format!("{:02x}{:02x}{:02x}", self.r, self.g, self.b)
	}

	pub fn to_rgb_string(self) -> String {
		format!("{}, {}, {}", self.r, self.g, self.b)
	}

	pub fn to_rgba_string(self, alpha: f64) -> String {
		format!("rgba({}, {}, {}, {})", self.r, self.g, self.b, alpha)
	}

	pub fn to_hsl(self) -> Hsl {
		let r = self.r as f64 / 255.0;
		let g = self.g as f64 / 255.0;
		let b = self.b as f64 / 255.0;

		let max = r.max(g).max(b);
		let min = r.min(g).min(b);
		let l = (max + min) / 2.0;

		if (max - min).abs() < f64::EPSILON {
			return Hsl { h: 0.0, s: 0.0, l };
		}

		let d = max - min;
		let s = if l > 0.5 {
			d / (2.0 - max - min)
		} else {
			d / (max + min)
		};

		let h = if (max - r).abs() < f64::EPSILON {
			let mut h = (g - b) / d;
			if g < b {
				h += 6.0;
			}
			h
		} else if (max - g).abs() < f64::EPSILON {
			(b - r) / d + 2.0
		} else {
			(r - g) / d + 4.0
		};

		Hsl { h: h * 60.0, s, l }
	}

}

impl Hsl {
	pub fn new(h: f64, s: f64, l: f64) -> Self {
		Self { h, s, l }
	}

	pub fn to_rgb(self) -> Rgb {
		if self.s.abs() < f64::EPSILON {
			let v = (self.l * 255.0).round() as u8;
			return Rgb::new(v, v, v);
		}

		let q = if self.l < 0.5 {
			self.l * (1.0 + self.s)
		} else {
			self.l + self.s - self.l * self.s
		};
		let p = 2.0 * self.l - q;
		let h = self.h / 360.0;

		let r = hue_to_rgb(p, q, h + 1.0 / 3.0);
		let g = hue_to_rgb(p, q, h);
		let b = hue_to_rgb(p, q, h - 1.0 / 3.0);

		Rgb::new(
			(r * 255.0).round() as u8,
			(g * 255.0).round() as u8,
			(b * 255.0).round() as u8,
		)
	}
}

fn hue_to_rgb(p: f64, q: f64, mut t: f64) -> f64 {
	if t < 0.0 {
		t += 1.0;
	}
	if t > 1.0 {
		t -= 1.0;
	}
	if t < 1.0 / 6.0 {
		return p + (q - p) * 6.0 * t;
	}
	if t < 1.0 / 2.0 {
		return q;
	}
	if t < 2.0 / 3.0 {
		return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
	}
	p
}

impl fmt::Display for Rgb {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		write!(f, "{}", self.to_hex())
	}
}

#[derive(Debug, Clone)]
pub struct Palette {
	pub colors: [Rgb; 16],
}

impl Palette {
	pub fn new(colors: [Rgb; 16]) -> Self {
		Self { colors }
	}

	pub fn background(&self) -> Rgb {
		self.colors[0]
	}

	pub fn foreground(&self) -> Rgb {
		self.colors[15]
	}
}

impl Default for Palette {
	fn default() -> Self {
		Self {
			colors: [
				Rgb::from_hex("#1a1b26").unwrap(),
				Rgb::from_hex("#f7768e").unwrap(),
				Rgb::from_hex("#9ece6a").unwrap(),
				Rgb::from_hex("#e0af68").unwrap(),
				Rgb::from_hex("#7aa2f7").unwrap(),
				Rgb::from_hex("#bb9af7").unwrap(),
				Rgb::from_hex("#7dcfff").unwrap(),
				Rgb::from_hex("#a9b1d6").unwrap(),
				Rgb::from_hex("#414868").unwrap(),
				Rgb::from_hex("#f7768e").unwrap(),
				Rgb::from_hex("#9ece6a").unwrap(),
				Rgb::from_hex("#e0af68").unwrap(),
				Rgb::from_hex("#7aa2f7").unwrap(),
				Rgb::from_hex("#bb9af7").unwrap(),
				Rgb::from_hex("#7dcfff").unwrap(),
				Rgb::from_hex("#c0caf5").unwrap(),
			],
		}
	}
}
