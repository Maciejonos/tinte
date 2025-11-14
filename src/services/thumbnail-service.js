import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GdkPixbuf from "gi://GdkPixbuf";
import Gdk from "gi://Gdk?version=4.0";

export class ThumbnailService {
  constructor() {
    this.cacheDir = GLib.build_filenamev([
      GLib.get_user_cache_dir(),
      "tinte",
      "thumbnails",
    ]);

    GLib.mkdir_with_parents(this.cacheDir, 0o755);
  }

  _getCacheKey(imagePath, width, height) {
    const str = `${imagePath}-${width}x${height}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    const hashStr = Math.abs(hash).toString(16);
    const basename = GLib.path_get_basename(imagePath);

    return `${hashStr}-${basename}.png`;
  }

  async getThumbnail(imagePath, width, height) {
    const cacheKey = this._getCacheKey(imagePath, width, height);
    const cachePath = GLib.build_filenamev([this.cacheDir, cacheKey]);
    const cacheFile = Gio.File.new_for_path(cachePath);

    if (cacheFile.query_exists(null)) {
      try {
        return this._loadTexture(cachePath);
      } catch (e) {
        console.warn(`Failed to load cached thumbnail for ${imagePath}:`, e.message);
      }
    }

    return new Promise((resolve) => {
      GLib.idle_add(GLib.PRIORITY_LOW, () => {
        try {
          const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
            imagePath,
            width,
            height,
            true,
          );
          pixbuf.savev(cachePath, "png", [], []);
          resolve(this._loadTexture(cachePath));
        } catch (e) {
          console.error(`Failed to generate thumbnail for ${imagePath}:`, e.message);
          resolve(null);
        }
        return GLib.SOURCE_REMOVE;
      });
    });
  }

  _loadTexture(path) {
    const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
    return Gdk.Texture.new_for_pixbuf(pixbuf);
  }

  syncCache(currentWallpapers, width, height) {
    try {
      const dir = Gio.File.new_for_path(this.cacheDir);
      if (!dir.query_exists(null)) return;

      const validCacheKeys = new Set(
        currentWallpapers.map((path) => this._getCacheKey(path, width, height))
      );

      const enumerator = dir.enumerate_children(
        "standard::name",
        Gio.FileQueryInfoFlags.NONE,
        null,
      );

      try {
        let deleted = 0;
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null))) {
          const fileName = fileInfo.get_name();
          if (!validCacheKeys.has(fileName)) {
            try {
              const filePath = GLib.build_filenamev([this.cacheDir, fileName]);
              Gio.File.new_for_path(filePath).delete(null);
              deleted++;
            } catch (e) {
              console.warn(`Failed to delete stale cache file ${fileName}:`, e.message);
            }
          }
        }

        if (deleted > 0) {
          console.log(`Cleaned up ${deleted} stale thumbnail(s) from cache`);
        }
      } finally {
        enumerator.close(null);
      }
    } catch (e) {
      console.error("Failed to sync thumbnail cache:", e.message);
    }
  }

  clearCache() {
    try {
      const dir = Gio.File.new_for_path(this.cacheDir);
      if (!dir.query_exists(null)) return true;

      const enumerator = dir.enumerate_children(
        "standard::name",
        Gio.FileQueryInfoFlags.NONE,
        null,
      );

      try {
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null))) {
          const filePath = GLib.build_filenamev([this.cacheDir, fileInfo.get_name()]);
          Gio.File.new_for_path(filePath).delete(null);
        }
      } finally {
        enumerator.close(null);
      }

      return true;
    } catch (e) {
      console.error("Failed to clear thumbnail cache:", e.message);
      return false;
    }
  }
}
