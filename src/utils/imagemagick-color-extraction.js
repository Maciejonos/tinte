import GLib from "gi://GLib";
import Gio from "gi://Gio";
import { hexToRgb, rgbToHsl, hslToHex } from "./color-utils.js";
import {
  readFileAsText,
  writeTextToFile,
  fileExists,
  ensureDirectoryExists,
} from "./file-utils.js";

const ANSI_PALETTE_SIZE = 16;

const DOMINANT_COLORS_TO_EXTRACT = 24;

const CACHE_VERSION = 3;

const MONOCHROME_SATURATION_THRESHOLD = 15;

const MONOCHROME_IMAGE_THRESHOLD = 0.7;

const LOW_DIVERSITY_THRESHOLD = 0.6;

const SIMILAR_HUE_RANGE = 30;

const SIMILAR_LIGHTNESS_RANGE = 20;

const MIN_CHROMATIC_SATURATION = 15;

const TOO_DARK_THRESHOLD = 20;

const TOO_BRIGHT_THRESHOLD = 85;

const VERY_DARK_BACKGROUND_THRESHOLD = 20;

const VERY_LIGHT_BACKGROUND_THRESHOLD = 80;

const MIN_BACKGROUND_LIGHTNESS_DARK = 8;

const MAX_BACKGROUND_LIGHTNESS_LIGHT = 92;

const MIN_LIGHTNESS_ON_DARK_BG = 55;

const MAX_LIGHTNESS_ON_LIGHT_BG = 45;

const MIN_FOREGROUND_CONTRAST = 40;

const ABSOLUTE_MIN_LIGHTNESS = 25;

const OUTLIER_LIGHTNESS_THRESHOLD = 25;

const BRIGHT_THEME_THRESHOLD = 50;

const DARK_COLOR_THRESHOLD = 50;

const SUBTLE_PALETTE_SATURATION = 28;

const MONOCHROME_SATURATION = 5;

const MONOCHROME_COLOR8_SATURATION_FACTOR = 0.5;

const BRIGHT_COLOR_LIGHTNESS_BOOST = 18;

const BRIGHT_COLOR_SATURATION_BOOST = 1.25;

const ANSI_COLOR_HUES = {
  RED: 0,
  GREEN: 120,
  YELLOW: 60,
  BLUE: 240,
  MAGENTA: 300,
  CYAN: 180,
};

const ANSI_HUE_ARRAY = [
  ANSI_COLOR_HUES.RED,
  ANSI_COLOR_HUES.GREEN,
  ANSI_COLOR_HUES.YELLOW,
  ANSI_COLOR_HUES.BLUE,
  ANSI_COLOR_HUES.MAGENTA,
  ANSI_COLOR_HUES.CYAN,
];

const IMAGE_SCALE_SIZE = "800x600>";

const IMAGE_BIT_DEPTH = 8;

function getCacheDir() {
  const homeDir = GLib.get_home_dir();
  return GLib.build_filenamev([homeDir, ".cache", "tinte", "color-cache"]);
}

function getCacheKey(imagePath, lightMode) {
  try {
    const file = Gio.File.new_for_path(imagePath);
    const info = file.query_info(
      "time::modified",
      Gio.FileQueryInfoFlags.NONE,
      null,
    );
    const mtime = info.get_modification_date_time();
    const mtimeSeconds = mtime.to_unix();

    const dataString = `${imagePath}-${mtimeSeconds}-${lightMode ? "light" : "dark"}`;
    const checksum = GLib.compute_checksum_for_string(
      GLib.ChecksumType.MD5,
      dataString,
      -1,
    );

    return checksum;
  } catch (e) {
    console.error("Error generating cache key:", e.message);
    return null;
  }
}

function loadCachedPalette(cacheKey) {
  try {
    const cacheDir = getCacheDir();
    const cachePath = GLib.build_filenamev([cacheDir, `${cacheKey}.json`]);

    if (!fileExists(cachePath)) {
      return null;
    }

    const content = readFileAsText(cachePath);
    const data = JSON.parse(content);

    if (
      data.version === CACHE_VERSION &&
      Array.isArray(data.palette) &&
      data.palette.length === ANSI_PALETTE_SIZE
    ) {
      console.log("Using cached color extraction result");
      return data.palette;
    }

    return null;
  } catch (e) {
    console.error("Error loading cache:", e.message);
    return null;
  }
}

function savePaletteToCache(cacheKey, palette) {
  try {
    const cacheDir = getCacheDir();
    ensureDirectoryExists(cacheDir);

    const cachePath = GLib.build_filenamev([cacheDir, `${cacheKey}.json`]);
    const data = {
      palette: palette,
      version: CACHE_VERSION,
    };

    writeTextToFile(cachePath, JSON.stringify(data, null, 2));
    console.log("Saved color extraction to cache");
  } catch (e) {
    console.error("Error saving to cache:", e.message);
  }
}

function extractDominantColors(imagePath, numColors) {
  return new Promise((resolve, reject) => {
    try {
      const argv = [
        "magick",
        imagePath,
        "-scale",
        IMAGE_SCALE_SIZE,
        "-colors",
        numColors.toString(),
        "-depth",
        IMAGE_BIT_DEPTH.toString(),
        "-format",
        "%c",
        "histogram:info:-",
      ];

      const proc = Gio.Subprocess.new(
        argv,
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      );

      proc.communicate_utf8_async(null, null, (source, result) => {
        try {
          const [, stdout, stderr] = source.communicate_utf8_finish(result);
          const exitCode = source.get_exit_status();

          if (exitCode !== 0) {
            reject(new Error(`ImageMagick error: ${stderr}`));
            return;
          }

          const colors = parseHistogramOutput(stdout);
          if (colors.length === 0) {
            reject(new Error("No colors extracted from image"));
            return;
          }

          resolve(colors);
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function parseHistogramOutput(output) {
  const lines = output.split("\n");
  const colorData = [];

  for (const line of lines) {
    const match = line.match(/^\s*(\d+):\s*\([^)]+\)\s*(#[0-9A-Fa-f]{6})/);
    if (match) {
      const count = parseInt(match[1], 10);
      const hex = match[2].toUpperCase();
      colorData.push({ hex, count });
    }
  }

  colorData.sort((a, b) => b.count - a.count);
  return colorData.map((c) => c.hex);
}

function isDarkColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hsl.l < DARK_COLOR_THRESHOLD;
}

const hslCache = new Map();

function getColorHSL(hexColor) {
  if (hslCache.has(hexColor)) {
    return hslCache.get(hexColor);
  }

  const rgb = hexToRgb(hexColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hslCache.set(hexColor, hsl);
  return hsl;
}

function clearHSLCache() {
  hslCache.clear();
}

function calculateHueDistance(hue1, hue2) {
  let diff = Math.abs(hue1 - hue2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function isMonochromeImage(colors) {
  let lowSaturationCount = 0;

  for (const color of colors) {
    const hsl = getColorHSL(color);
    if (hsl.s < MONOCHROME_SATURATION_THRESHOLD) {
      lowSaturationCount++;
    }
  }

  return lowSaturationCount / colors.length > MONOCHROME_IMAGE_THRESHOLD;
}

function hasLowColorDiversity(colors) {
  const hslColors = colors.map((color) => {
    const hsl = getColorHSL(color);
    return { hue: hsl.h, saturation: hsl.s, lightness: hsl.l };
  });

  let similarCount = 0;
  let totalComparisons = 0;

  for (let i = 0; i < hslColors.length; i++) {
    for (let j = i + 1; j < hslColors.length; j++) {
      const color1 = hslColors[i];
      const color2 = hslColors[j];

      if (
        color1.saturation < MONOCHROME_SATURATION_THRESHOLD ||
        color2.saturation < MONOCHROME_SATURATION_THRESHOLD
      ) {
        continue;
      }

      totalComparisons++;

      const hueDiff = calculateHueDistance(color1.hue, color2.hue);
      const lightnessDiff = Math.abs(color1.lightness - color2.lightness);

      if (
        hueDiff < SIMILAR_HUE_RANGE &&
        lightnessDiff < SIMILAR_LIGHTNESS_RANGE
      ) {
        similarCount++;
      }
    }
  }

  if (totalComparisons === 0) return false;

  return similarCount / totalComparisons > LOW_DIVERSITY_THRESHOLD;
}

function findBackgroundColor(colors, lightMode) {
  let bgIndex = -1;
  let bgLightness = lightMode ? -1 : 101;

  for (let i = 0; i < colors.length; i++) {
    const hsl = getColorHSL(colors[i]);

    if (lightMode) {
      if (hsl.l > bgLightness && hsl.l <= MAX_BACKGROUND_LIGHTNESS_LIGHT) {
        bgLightness = hsl.l;
        bgIndex = i;
      }
    } else {
      if (hsl.l < bgLightness && hsl.l >= MIN_BACKGROUND_LIGHTNESS_DARK) {
        bgLightness = hsl.l;
        bgIndex = i;
      }
    }
  }

  if (bgIndex === -1) {
    console.log("No color found within threshold, finding closest match");
    const targetLightness = lightMode
      ? MAX_BACKGROUND_LIGHTNESS_LIGHT
      : MIN_BACKGROUND_LIGHTNESS_DARK;

    let closestIndex = 0;
    let closestDistance = Infinity;

    for (let i = 0; i < colors.length; i++) {
      const hsl = getColorHSL(colors[i]);
      const distance = Math.abs(hsl.l - targetLightness);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    bgIndex = closestIndex;
  }

  const selectedColor = colors[bgIndex];
  const selectedHsl = getColorHSL(selectedColor);

  if (!lightMode && selectedHsl.l < MIN_BACKGROUND_LIGHTNESS_DARK) {
    console.log(
      `Background too dark (${selectedHsl.l}%), adjusting to minimum ${MIN_BACKGROUND_LIGHTNESS_DARK}%`,
    );
    return {
      color: hslToHex(
        selectedHsl.h,
        selectedHsl.s,
        MIN_BACKGROUND_LIGHTNESS_DARK,
      ),
      index: bgIndex,
    };
  }

  if (lightMode && selectedHsl.l > MAX_BACKGROUND_LIGHTNESS_LIGHT) {
    console.log(
      `Background too bright (${selectedHsl.l}%), adjusting to maximum ${MAX_BACKGROUND_LIGHTNESS_LIGHT}%`,
    );
    return {
      color: hslToHex(
        selectedHsl.h,
        selectedHsl.s,
        MAX_BACKGROUND_LIGHTNESS_LIGHT,
      ),
      index: bgIndex,
    };
  }

  return { color: selectedColor, index: bgIndex };
}

function findForegroundColor(colors, lightMode, usedIndices, bgLightness) {
  let fgIndex = -1;
  let fgLightness = lightMode ? 101 : -1;

  for (let i = 0; i < colors.length; i++) {
    if (usedIndices.has(i)) continue;

    const hsl = getColorHSL(colors[i]);

    if (lightMode) {
      if (hsl.l < fgLightness) {
        fgLightness = hsl.l;
        fgIndex = i;
      }
    } else {
      if (hsl.l > fgLightness) {
        fgLightness = hsl.l;
        fgIndex = i;
      }
    }
  }

  if (fgIndex === -1) {
    console.log(
      "No suitable foreground color found in palette, generating synthetic foreground",
    );
    const targetLightness = lightMode
      ? Math.max(0, bgLightness - MIN_FOREGROUND_CONTRAST)
      : Math.min(100, bgLightness + MIN_FOREGROUND_CONTRAST);

    return {
      color: hslToHex(0, 0, targetLightness),
      index: 0,
    };
  }

  const selectedColor = colors[fgIndex];
  const selectedHsl = getColorHSL(selectedColor);
  const contrast = Math.abs(selectedHsl.l - bgLightness);

  if (contrast < MIN_FOREGROUND_CONTRAST) {
    console.log(
      `Foreground contrast too low (${contrast.toFixed(1)}%), adjusting for minimum ${MIN_FOREGROUND_CONTRAST}% contrast`,
    );
    const targetLightness = lightMode
      ? Math.max(0, bgLightness - MIN_FOREGROUND_CONTRAST)
      : Math.min(100, bgLightness + MIN_FOREGROUND_CONTRAST);

    return {
      color: hslToHex(selectedHsl.h, selectedHsl.s, targetLightness),
      index: fgIndex,
    };
  }

  return { color: selectedColor, index: fgIndex };
}

function calculateColorScore(hsl, targetHue) {
  const hueDiff = calculateHueDistance(hsl.h, targetHue) * 3;

  const saturationPenalty = hsl.s < MIN_CHROMATIC_SATURATION ? 50 : 0;

  let lightnessPenalty = 0;
  if (hsl.l < TOO_DARK_THRESHOLD) {
    lightnessPenalty = 10;
  } else if (hsl.l > TOO_BRIGHT_THRESHOLD) {
    lightnessPenalty = 10;
  }

  return hueDiff + saturationPenalty + lightnessPenalty;
}

function findBestColorMatch(targetHue, colorPool, usedIndices) {
  let bestIndex = -1;
  let bestScore = Infinity;

  for (let i = 0; i < colorPool.length; i++) {
    if (usedIndices.has(i)) continue;

    const hsl = getColorHSL(colorPool[i]);
    const score = calculateColorScore(hsl, targetHue);

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    for (let i = 0; i < colorPool.length; i++) {
      if (!usedIndices.has(i)) {
        return i;
      }
    }
    console.warn(
      "All colors in pool are used, returning first available index",
    );
    return 0;
  }

  return bestIndex;
}

function generateBrightVersion(hexColor) {
  const hsl = getColorHSL(hexColor);
  const newLightness = Math.min(100, hsl.l + BRIGHT_COLOR_LIGHTNESS_BOOST);
  const newSaturation = Math.min(100, hsl.s * BRIGHT_COLOR_SATURATION_BOOST);
  return hslToHex(hsl.h, newSaturation, newLightness);
}

function adjustColorLightness(hexColor, targetLightness) {
  const hsl = getColorHSL(hexColor);
  return hslToHex(hsl.h, hsl.s, targetLightness);
}

function sortColorsByLightness(colors) {
  return colors
    .map((color) => {
      const hsl = getColorHSL(color);
      return { color, lightness: hsl.l, hue: hsl.h };
    })
    .sort((a, b) => a.lightness - b.lightness);
}

function generateSubtleBalancedPalette(dominantColors, lightMode) {
  const sortedByLightness = sortColorsByLightness(dominantColors);
  const darkest = sortedByLightness[0];
  const lightest = sortedByLightness[sortedByLightness.length - 1];

  const chromaticColors = dominantColors.filter(
    (c) => getColorHSL(c).s > MONOCHROME_SATURATION_THRESHOLD,
  );
  const avgHue =
    chromaticColors.length > 0
      ? chromaticColors.reduce((sum, c) => sum + getColorHSL(c).h, 0) /
        chromaticColors.length
      : darkest.hue;

  const palette = new Array(ANSI_PALETTE_SIZE);

  palette[0] = lightMode ? lightest.color : darkest.color;
  palette[7] = lightMode ? darkest.color : lightest.color;

  for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
    const lightness = 50 + (i - 2.5) * 4;
    palette[i + 1] = hslToHex(
      ANSI_HUE_ARRAY[i],
      SUBTLE_PALETTE_SATURATION,
      lightness,
    );
  }

  const color8Lightness = lightMode
    ? Math.max(0, lightest.lightness - 15)
    : Math.min(100, darkest.lightness + 15);
  palette[8] = hslToHex(
    avgHue,
    SUBTLE_PALETTE_SATURATION * 0.5,
    color8Lightness,
  );

  const brightSaturation = SUBTLE_PALETTE_SATURATION + 8;
  for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
    const baseLightness = 50 + (i - 2.5) * 4;
    const adjustment = lightMode ? -8 : 8;
    const lightness = Math.max(0, Math.min(100, baseLightness + adjustment));
    palette[i + 9] = hslToHex(ANSI_HUE_ARRAY[i], brightSaturation, lightness);
  }

  palette[15] = lightMode
    ? hslToHex(
        avgHue,
        SUBTLE_PALETTE_SATURATION * 0.3,
        Math.max(0, darkest.lightness - 5),
      )
    : hslToHex(
        avgHue,
        SUBTLE_PALETTE_SATURATION * 0.3,
        Math.min(100, lightest.lightness + 5),
      );

  return palette;
}

function generateMonochromePalette(grayColors, lightMode) {
  const sortedByLightness = sortColorsByLightness(grayColors);
  const darkest = sortedByLightness[0];
  const lightest = sortedByLightness[sortedByLightness.length - 1];
  const baseHue = darkest.hue;

  const palette = new Array(ANSI_PALETTE_SIZE);

  palette[0] = lightMode ? lightest.color : darkest.color;
  palette[7] = lightMode ? darkest.color : lightest.color;

  const MIN_STEP = 3;

  if (lightMode) {
    let startL = darkest.lightness + 10;
    let endL = Math.min(darkest.lightness + 40, lightest.lightness - 10);

    if (endL <= startL) {
      startL = Math.max(0, darkest.lightness);
      endL = Math.min(100, lightest.lightness);
    }

    const range = Math.max(endL - startL, MIN_STEP * 5);
    const step = range / 5;

    for (let i = 1; i <= 6; i++) {
      const lightness = Math.max(0, Math.min(100, startL + (i - 1) * step));
      palette[i] = hslToHex(baseHue, MONOCHROME_SATURATION, lightness);
    }
  } else {
    let startL = Math.max(darkest.lightness + 30, lightest.lightness - 40);
    let endL = lightest.lightness - 10;

    if (endL <= startL) {
      startL = Math.max(0, darkest.lightness + 10);
      endL = Math.min(100, lightest.lightness);
    }

    const range = Math.max(endL - startL, MIN_STEP * 5);
    const step = range / 5;

    for (let i = 1; i <= 6; i++) {
      const lightness = Math.max(0, Math.min(100, startL + (i - 1) * step));
      palette[i] = hslToHex(baseHue, MONOCHROME_SATURATION, lightness);
    }
  }

  const color8Lightness = lightMode
    ? Math.max(0, darkest.lightness + 5)
    : Math.min(100, lightest.lightness - 25);
  palette[8] = hslToHex(
    baseHue,
    MONOCHROME_SATURATION * MONOCHROME_COLOR8_SATURATION_FACTOR,
    color8Lightness,
  );

  for (let i = 1; i <= 6; i++) {
    const hsl = getColorHSL(palette[i]);
    const adjustment = lightMode ? -10 : 10;
    const newL = Math.max(0, Math.min(100, hsl.l + adjustment));
    palette[i + 8] = hslToHex(baseHue, MONOCHROME_SATURATION, newL);
  }

  palette[15] = lightMode
    ? hslToHex(baseHue, 2, Math.max(0, darkest.lightness - 5))
    : hslToHex(baseHue, 2, Math.min(100, lightest.lightness + 5));

  return palette;
}

function adjustColorForDarkBackground(palette, colorInfo) {
  if (colorInfo.lightness >= MIN_LIGHTNESS_ON_DARK_BG) {
    return;
  }

  const adjustedLightness = MIN_LIGHTNESS_ON_DARK_BG + colorInfo.index * 3;
  console.log(
    `Adjusting color ${colorInfo.index} for dark background: ${colorInfo.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`,
  );

  palette[colorInfo.index] = adjustColorLightness(
    palette[colorInfo.index],
    adjustedLightness,
  );

  if (colorInfo.index >= 1 && colorInfo.index <= 6) {
    palette[colorInfo.index + 8] = generateBrightVersion(
      palette[colorInfo.index],
    );
  }
}

function adjustColorForLightBackground(palette, colorInfo) {
  if (colorInfo.lightness <= MAX_LIGHTNESS_ON_LIGHT_BG) {
    return;
  }

  const adjustedLightness = Math.max(
    ABSOLUTE_MIN_LIGHTNESS,
    MAX_LIGHTNESS_ON_LIGHT_BG - colorInfo.index * 2,
  );
  console.log(
    `Adjusting color ${colorInfo.index} for light background: ${colorInfo.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`,
  );

  palette[colorInfo.index] = adjustColorLightness(
    palette[colorInfo.index],
    adjustedLightness,
  );

  if (colorInfo.index >= 1 && colorInfo.index <= 6) {
    palette[colorInfo.index + 8] = generateBrightVersion(
      palette[colorInfo.index],
    );
  }
}

function adjustOutlierColor(palette, outlier, avgLightness, isBrightTheme) {
  const isDarkOutlierInBrightTheme =
    isBrightTheme &&
    outlier.lightness < avgLightness - OUTLIER_LIGHTNESS_THRESHOLD;

  const isBrightOutlierInDarkTheme =
    !isBrightTheme &&
    outlier.lightness > avgLightness + OUTLIER_LIGHTNESS_THRESHOLD;

  if (!isDarkOutlierInBrightTheme && !isBrightOutlierInDarkTheme) {
    return;
  }

  const adjustedLightness = isDarkOutlierInBrightTheme
    ? avgLightness - 10
    : avgLightness + 10;

  const outlierType = isDarkOutlierInBrightTheme ? "dark" : "bright";
  console.log(
    `Adjusting ${outlierType} outlier color ${outlier.index}: ${outlier.lightness.toFixed(1)}% → ${adjustedLightness.toFixed(1)}%`,
  );

  palette[outlier.index] = adjustColorLightness(
    palette[outlier.index],
    adjustedLightness,
  );

  if (outlier.index >= 1 && outlier.index <= 6) {
    palette[outlier.index + 8] = generateBrightVersion(palette[outlier.index]);
  }
}

function normalizeBrightness(palette) {
  const bgHsl = getColorHSL(palette[0]);
  let bgLightness = bgHsl.l;

  if (bgLightness < MIN_BACKGROUND_LIGHTNESS_DARK) {
    console.log(
      `Normalizing background from ${bgLightness}% to ${MIN_BACKGROUND_LIGHTNESS_DARK}%`,
    );
    palette[0] = hslToHex(bgHsl.h, bgHsl.s, MIN_BACKGROUND_LIGHTNESS_DARK);
    bgLightness = MIN_BACKGROUND_LIGHTNESS_DARK;
  } else if (bgLightness > MAX_BACKGROUND_LIGHTNESS_LIGHT) {
    console.log(
      `Normalizing background from ${bgLightness}% to ${MAX_BACKGROUND_LIGHTNESS_LIGHT}%`,
    );
    palette[0] = hslToHex(bgHsl.h, bgHsl.s, MAX_BACKGROUND_LIGHTNESS_LIGHT);
    bgLightness = MAX_BACKGROUND_LIGHTNESS_LIGHT;
  }

  const isVeryDarkBg = bgLightness < VERY_DARK_BACKGROUND_THRESHOLD;
  const isVeryLightBg = bgLightness > VERY_LIGHT_BACKGROUND_THRESHOLD;

  const colorIndices = [1, 2, 3, 4, 5, 6, 7];
  const ansiColors = colorIndices.map((i) => {
    const hsl = getColorHSL(palette[i]);
    return { index: i, lightness: hsl.l, hue: hsl.h, saturation: hsl.s };
  });

  const avgLightness =
    ansiColors.reduce((sum, c) => sum + c.lightness, 0) / ansiColors.length;
  const isBrightTheme = avgLightness > BRIGHT_THEME_THRESHOLD;

  if (isVeryDarkBg) {
    ansiColors.forEach((colorInfo) =>
      adjustColorForDarkBackground(palette, colorInfo),
    );
    return palette;
  }

  if (isVeryLightBg) {
    ansiColors.forEach((colorInfo) =>
      adjustColorForLightBackground(palette, colorInfo),
    );
    return palette;
  }

  const outliers = ansiColors.filter(
    (c) => Math.abs(c.lightness - avgLightness) > OUTLIER_LIGHTNESS_THRESHOLD,
  );

  outliers.forEach((outlier) =>
    adjustOutlierColor(palette, outlier, avgLightness, isBrightTheme),
  );

  const color8Hsl = getColorHSL(palette[8]);
  if (isVeryDarkBg && color8Hsl.l < MIN_LIGHTNESS_ON_DARK_BG) {
    const adjustedLightness = Math.min(
      MIN_LIGHTNESS_ON_DARK_BG,
      bgLightness + 15,
    );
    console.log(
      `Normalizing color8 (bright black) from ${color8Hsl.l}% to ${adjustedLightness}%`,
    );
    palette[8] = hslToHex(color8Hsl.h, color8Hsl.s, adjustedLightness);
  }

  const color15Hsl = getColorHSL(palette[15]);
  const fgHsl = getColorHSL(palette[7]);
  const color15Contrast = Math.abs(color15Hsl.l - bgLightness);

  if (color15Contrast < MIN_FOREGROUND_CONTRAST) {
    const targetLightness = isVeryDarkBg
      ? Math.min(100, bgLightness + MIN_FOREGROUND_CONTRAST + 10)
      : Math.max(0, bgLightness - MIN_FOREGROUND_CONTRAST - 10);
    console.log(
      `Normalizing color15 (bright white) from ${color15Hsl.l}% to ${targetLightness}% for better contrast`,
    );
    palette[15] = hslToHex(color15Hsl.h, color15Hsl.s, targetLightness);
  }

  return palette;
}

async function extractColorsWithImageMagick(imagePath, lightMode = false) {
  try {
    const cacheKey = getCacheKey(imagePath, lightMode);
    if (cacheKey) {
      const cachedPalette = loadCachedPalette(cacheKey);
      if (cachedPalette) {
        return cachedPalette;
      }
    }

    const dominantColors = await extractDominantColors(
      imagePath,
      DOMINANT_COLORS_TO_EXTRACT,
    );

    if (dominantColors.length < 8) {
      throw new Error("Not enough colors extracted from image");
    }

    clearHSLCache();

    let palette;

    if (isMonochromeImage(dominantColors)) {
      console.log(
        "Detected monochrome/grayscale image - generating grayscale palette",
      );
      palette = generateMonochromePalette(dominantColors, lightMode);
    } else if (hasLowColorDiversity(dominantColors)) {
      console.log(
        "Detected low color diversity - generating subtle balanced palette",
      );
      palette = generateSubtleBalancedPalette(dominantColors, lightMode);
    } else {
      console.log(
        "Detected diverse chromatic image - generating vibrant colorful palette",
      );
      palette = generateChromaticPalette(dominantColors, lightMode);
    }

    palette = normalizeBrightness(palette);

    if (cacheKey) {
      savePaletteToCache(cacheKey, palette);
    }

    return palette;
  } catch (e) {
    throw new Error(`ImageMagick color extraction failed: ${e.message}`);
  }
}

function generateChromaticPalette(dominantColors, lightMode) {
  const background = findBackgroundColor(dominantColors, lightMode);
  const usedIndices = new Set([background.index]);
  const bgHsl = getColorHSL(background.color);

  const foreground = findForegroundColor(
    dominantColors,
    lightMode,
    usedIndices,
    bgHsl.l,
  );
  usedIndices.add(foreground.index);

  const palette = new Array(ANSI_PALETTE_SIZE);
  palette[0] = background.color;
  palette[7] = foreground.color;

  for (let i = 0; i < ANSI_HUE_ARRAY.length; i++) {
    const matchIndex = findBestColorMatch(
      ANSI_HUE_ARRAY[i],
      dominantColors,
      usedIndices,
    );
    palette[i + 1] = dominantColors[matchIndex];
    usedIndices.add(matchIndex);
  }

  const color8Lightness = isDarkColor(background.color)
    ? Math.min(100, bgHsl.l + 15)
    : Math.max(0, bgHsl.l - 15);
  palette[8] = hslToHex(bgHsl.h, bgHsl.s * 0.5, color8Lightness);

  for (let i = 1; i <= 6; i++) {
    palette[i + 8] = generateBrightVersion(palette[i]);
  }

  palette[15] = generateBrightVersion(foreground.color);

  return palette;
}

export function extractColorsFromWallpaperIM(imagePath, onSuccess, onError) {
  extractColorsWithImageMagick(imagePath, false)
    .then((colors) => onSuccess(colors))
    .catch((error) => onError(error));
}
