import GLib from "gi://GLib";
import Gio from "gi://Gio";

export function readFileAsText(path) {
  const file = Gio.File.new_for_path(path);
  const [success, contents] = file.load_contents(null);

  if (!success) {
    throw new Error(`Could not read file: ${path}`);
  }

  const decoder = new TextDecoder();
  return decoder.decode(contents);
}

export function writeTextToFile(path, content) {
  try {
    const file = Gio.File.new_for_path(path);

    if (content === null || content === undefined) {
      content = "";
    }

    const contentStr = String(content);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(contentStr);

    const [success, etag] = file.replace_contents(
      bytes,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );

    if (!success) {
      throw new Error(`Failed to write file: ${path}`);
    }
  } catch (e) {
    console.error(`Error writing to ${path}:`, e.message);
    throw e;
  }
}

export function copyFile(sourcePath, destPath, overwrite = true) {
  try {
    const sourceFile = Gio.File.new_for_path(sourcePath);
    const destFile = Gio.File.new_for_path(destPath);

    const flags = overwrite
      ? Gio.FileCopyFlags.OVERWRITE
      : Gio.FileCopyFlags.NONE;
    sourceFile.copy(destFile, flags, null, null);

    return true;
  } catch (e) {
    console.error("Error copying file:", e.message);
    return false;
  }
}

export function deleteFile(path) {
  try {
    const file = Gio.File.new_for_path(path);
    file.delete(null);
    return true;
  } catch (e) {
    console.error("Error deleting file:", e.message);
    return false;
  }
}

export function ensureDirectoryExists(path, permissions = 0o755) {
  GLib.mkdir_with_parents(path, permissions);
}

export function enumerateDirectory(
  dirPath,
  callback,
  attributes = "standard::name,standard::type",
) {
  try {
    const dir = Gio.File.new_for_path(dirPath);
    const enumerator = dir.enumerate_children(
      attributes,
      Gio.FileQueryInfoFlags.NONE,
      null,
    );

    try {
      let fileInfo;
      while ((fileInfo = enumerator.next_file(null)) !== null) {
        const fileName = fileInfo.get_name();
        const filePath = GLib.build_filenamev([dirPath, fileName]);
        callback(fileInfo, filePath, fileName);
      }
    } finally {
      enumerator.close(null);
    }
  } catch (e) {
    console.error(`Error enumerating directory ${dirPath}:`, e.message);
  }
}

export function cleanDirectory(dirPath) {
  try {
    const dir = Gio.File.new_for_path(dirPath);

    if (!dir.query_exists(null)) {
      return true;
    }

    const enumerator = dir.enumerate_children(
      "standard::name",
      Gio.FileQueryInfoFlags.NONE,
      null,
    );

    try {
      let fileInfo;
      while ((fileInfo = enumerator.next_file(null)) !== null) {
        const fileName = fileInfo.get_name();
        const filePath = GLib.build_filenamev([dirPath, fileName]);
        deleteFile(filePath);
      }
    } finally {
      enumerator.close(null);
    }

    return true;
  } catch (e) {
    console.error("Error cleaning directory:", e.message);
    return false;
  }
}

export function fileExists(path) {
  const file = Gio.File.new_for_path(path);
  return file.query_exists(null);
}

export function loadJsonFile(path, defaultValue = null) {
  try {
    if (!fileExists(path)) {
      return defaultValue;
    }

    const content = readFileAsText(path);
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error loading JSON from ${path}:`, e.message);
    return defaultValue;
  }
}

export function saveJsonFile(path, data, pretty = true) {
  try {
    if (!data) {
      console.error("Cannot save null/undefined data to JSON file");
      return false;
    }
    const jsonStr = pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    if (!jsonStr) {
      console.error("JSON.stringify returned empty result");
      return false;
    }
    writeTextToFile(path, jsonStr);
    return true;
  } catch (e) {
    console.error(`Error saving JSON to ${path}:`, e.message);
    console.error(e.stack);
    return false;
  }
}
