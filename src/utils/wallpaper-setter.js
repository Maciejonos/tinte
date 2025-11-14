import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export function setWallpaperSwaybg(imagePath, onSuccess, onError) {
    try {
        let oldPid = null;

        try {
            const findProc = Gio.Subprocess.new(
                ['pgrep', '-x', 'swaybg'],
                Gio.SubprocessFlags.STDOUT_PIPE
            );

            const [, stdout] = findProc.communicate_utf8(null, null);
            if (stdout && stdout.trim()) {
                oldPid = stdout.trim();
            }
        } catch (e) {
            console.log('No existing swaybg process found');
        }

        GLib.spawn_async(
            null,
            ['swaybg', '-i', imagePath, '-m', 'fill'],
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null
        );

        if (oldPid) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                try {
                    GLib.spawn_async(
                        null,
                        ['kill', '-9', oldPid],
                        null,
                        GLib.SpawnFlags.SEARCH_PATH,
                        null
                    );
                } catch (e) {
                    console.warn('Failed to kill old swaybg:', e.message);
                }
                return GLib.SOURCE_REMOVE;
            });
        }

        if (onSuccess) {
            onSuccess();
        }
    } catch (e) {
        console.error('Error setting wallpaper with swaybg:', e.message);
        if (onError) {
            onError(e);
        }
    }
}

function getHyprctlMonitors(callback) {
    try {
        const proc = Gio.Subprocess.new(
            ['hyprctl', 'monitors', '-j'],
            Gio.SubprocessFlags.STDOUT_PIPE
        );

        proc.communicate_utf8_async(null, null, (source, result) => {
            try {
                const [, stdout] = source.communicate_utf8_finish(result);
                const monitors = JSON.parse(stdout);
                const monitorNames = monitors.map(m => m.name);
                callback(monitorNames);
            } catch (e) {
                console.error('Failed to parse monitors:', e.message);
                callback([]);
            }
        });
    } catch (e) {
        console.error('Failed to get monitors:', e.message);
        callback([]);
    }
}

function executeHyprpaperCommand(command, onSuccess, onError) {
    try {
        const proc = Gio.Subprocess.new(
            command,
            Gio.SubprocessFlags.STDOUT_PIPE
        );

        proc.communicate_utf8_async(null, null, (source, result) => {
            try {
                const [, stdout] = source.communicate_utf8_finish(result);
                const exitCode = source.get_exit_status();
                if (exitCode === 0) {
                    onSuccess(stdout ? stdout.trim() : '');
                } else {
                    onError(new Error(`Command failed with exit code ${exitCode}`));
                }
            } catch (e) {
                onError(e);
            }
        });
    } catch (e) {
        onError(e);
    }
}

function setWallpaperForMonitor(monitor, imagePath, retryCount, onSuccess, onError) {
    if (retryCount >= 10) {
        onError(new Error('Failed after 10 retries'));
        return;
    }

    executeHyprpaperCommand(
        ['hyprctl', 'hyprpaper', 'unload', 'all'],
        () => {
            executeHyprpaperCommand(
                ['hyprctl', 'hyprpaper', 'preload', imagePath],
                () => {
                    executeHyprpaperCommand(
                        ['hyprctl', 'hyprpaper', 'wallpaper', `${monitor},${imagePath}`],
                        (result) => {
                            if (result === 'ok') {
                                onSuccess();
                            } else {
                                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                                    setWallpaperForMonitor(monitor, imagePath, retryCount + 1, onSuccess, onError);
                                    return GLib.SOURCE_REMOVE;
                                });
                            }
                        },
                        (e) => {
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                                setWallpaperForMonitor(monitor, imagePath, retryCount + 1, onSuccess, onError);
                                return GLib.SOURCE_REMOVE;
                            });
                        }
                    );
                },
                onError
            );
        },
        onError
    );
}

export function setWallpaperHyprpaper(imagePath, onSuccess, onError) {
    try {
        const checkProc = Gio.Subprocess.new(
            ['pgrep', 'hyprpaper'],
            Gio.SubprocessFlags.STDOUT_PIPE
        );

        checkProc.communicate_utf8_async(null, null, (source, result) => {
            let hyprpaperRunning = false;

            try {
                const [, stdout] = source.communicate_utf8_finish(result);
                hyprpaperRunning = stdout && stdout.trim().length > 0;
            } catch (e) {
                hyprpaperRunning = false;
            }

            if (!hyprpaperRunning) {
                console.log('Starting hyprpaper...');
                GLib.spawn_async(
                    null,
                    ['hyprpaper'],
                    null,
                    GLib.SpawnFlags.SEARCH_PATH,
                    null
                );
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                    proceedWithWallpaperSet();
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                proceedWithWallpaperSet();
            }
        });

        function proceedWithWallpaperSet() {
            getHyprctlMonitors((monitors) => {
                if (monitors.length === 0) {
                    onError(new Error('No monitors found'));
                    return;
                }

                let completed = 0;
                let failed = false;

                monitors.forEach((monitor) => {
                    setWallpaperForMonitor(
                        monitor,
                        imagePath,
                        0,
                        () => {
                            completed++;
                            if (completed === monitors.length && !failed) {
                                onSuccess();
                            }
                        },
                        (e) => {
                            if (!failed) {
                                failed = true;
                                console.error(`Failed to set wallpaper for ${monitor}:`, e.message);
                                onError(e);
                            }
                        }
                    );
                });
            });
        }
    } catch (e) {
        console.error('Error setting wallpaper with hyprpaper:', e.message);
        if (onError) {
            onError(e);
        }
    }
}

export function setWallpaper(imagePath, backend, onSuccess, onError) {
    if (backend === 'hyprpaper') {
        setWallpaperHyprpaper(imagePath, onSuccess, onError);
    } else {
        setWallpaperSwaybg(imagePath, onSuccess, onError);
    }
}
