use anyhow::{Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize, Default)]
pub struct Config {
	#[serde(default)]
	pub config: GlobalConfig,
	#[serde(default)]
	pub templates: HashMap<String, TemplateConfig>,
}

#[derive(Debug, Deserialize, Default)]
pub struct GlobalConfig {
	pub wallpaper_cmd: Option<String>,
	pub post_hook: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TemplateConfig {
	pub input_path: String,
	pub output_path: String,
	pub post_hook: Option<String>,
}

impl Config {
	pub fn load(path: Option<&PathBuf>) -> Result<Self> {
		let config_path = path.cloned().unwrap_or_else(default_config_path);

		if !config_path.exists() {
			return Ok(Self::default());
		}

		let content = fs::read_to_string(&config_path)
			.with_context(|| format!("Failed to read config: {}", config_path.display()))?;

		toml::from_str(&content)
			.with_context(|| format!("Failed to parse config: {}", config_path.display()))
	}
}

fn default_config_path() -> PathBuf {
	dirs::config_dir()
		.unwrap_or_else(|| PathBuf::from("~/.config"))
		.join("tinte")
		.join("config.toml")
}

pub fn expand_path(path: &str) -> PathBuf {
	if let Some(rest) = path.strip_prefix("~/")
		&& let Some(home) = dirs::home_dir()
	{
		return home.join(rest);
	}
	PathBuf::from(path)
}
