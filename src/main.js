#!/usr/bin/env gjs

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import { PaletteEditor } from './components/PaletteEditor.js';
import { ActionBar } from './components/ActionBar.js';
import { ConfigWriter } from './utils/ConfigWriter.js';
import { ThemeExporter } from './services/ThemeExporter.js';
import { SettingsManager } from './services/SettingsManager.js';
import { SettingsDialog } from './components/SettingsDialog.js';
import { runMatugen } from './utils/matugen-extraction.js';
import { SignalManager } from './utils/SignalManager.js';

Adw.init();

const TinteApplication = GObject.registerClass(
    class TinteApplication extends Adw.Application {
        _init() {
            super._init({
                application_id: 'org.tinte.Tinte',
                flags: Gio.ApplicationFlags.FLAGS_NONE,
            });
        }

        vfunc_activate() {
            let window = this.active_window;
            if (!window) {
                window = new TinteWindow(this);
            }
            window.present();
        }
    }
);

const TinteWindow = GObject.registerClass(
    class TinteWindow extends Adw.ApplicationWindow {
        _init(application) {
            super._init({
                application,
                title: 'Tinte',
                default_width: 900,
                default_height: 700,
            });

            this._signals = new SignalManager();

            this._initializeUI();
            this._connectSignals();

            this.connect('unrealize', () => {
                this._signals.disconnectAll();
            });
        }

        _initializeUI() {
            this.settingsManager = new SettingsManager();
            this.configWriter = new ConfigWriter(this.settingsManager);
            this.themeExporter = new ThemeExporter(this.settingsManager);

            this.paletteEditor = new PaletteEditor(this.settingsManager);
            this.actionBar = new ActionBar(this.settingsManager);

            const toolbarView = new Adw.ToolbarView();

            const headerBar = new Adw.HeaderBar();

            const settingsBtn = new Gtk.Button({
                icon_name: 'emblem-system-symbolic',
                tooltip_text: 'Settings',
            });
            this._signals.connect(settingsBtn, 'clicked', () => this._showSettings());
            headerBar.pack_end(settingsBtn);

            toolbarView.add_top_bar(headerBar);

            const toastOverlay = new Adw.ToastOverlay();
            this.toastOverlay = toastOverlay;

            const mainBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hexpand: true,
            });

            const clamp = new Adw.Clamp({
                maximum_size: 800,
                tightening_threshold: 600,
                child: this.paletteEditor,
            });

            scrolled.set_child(clamp);
            mainBox.append(scrolled);
            mainBox.append(this.actionBar);

            toastOverlay.set_child(mainBox);
            toolbarView.set_content(toastOverlay);
            this.set_content(toolbarView);

            this.colorRoles = null;
        }

        _connectSignals() {
            this._signals.connect(this.paletteEditor, 'palette-generated', (_, palette) => {
                this.colorRoles = this._mapPaletteToRoles(palette);
                this._showToast('Colors extracted successfully');
            });

            this._signals.connect(this.paletteEditor, 'show-message', (_, message) => {
                this._showToast(message);
            });

            this._signals.connect(this.actionBar, 'export-theme', () => {
                this._exportTheme();
            });

            this._signals.connect(this.actionBar, 'apply-theme', () => {
                this._applyTheme();
            });

            this._signals.connect(this.actionBar, 'reset', () => {
                this._resetApplication();
                this.actionBar.setBackVisible(false);
            });

            this._signals.connect(this.actionBar, 'back', () => {
                this.paletteEditor.back();
                this.actionBar.setBackVisible(false);
            });

            this._signals.connect(this.paletteEditor, 'wallpaper-loaded', () => {
                this.actionBar.setBackVisible(true);
            });
        }

        _mapPaletteToRoles(palette) {
            return {
                background: palette[0],
                foreground: palette[15],
                color0: palette[0],
                color1: palette[1],
                color2: palette[2],
                color3: palette[3],
                color4: palette[4],
                color5: palette[5],
                color6: palette[6],
                color7: palette[7],
                color8: palette[8],
                color9: palette[9],
                color10: palette[10],
                color11: palette[11],
                color12: palette[12],
                color13: palette[13],
                color14: palette[14],
                color15: palette[15],
            };
        }

        _exportTheme() {
            if (!this.colorRoles) {
                this._showToast('Please extract colors first');
                return;
            }

            if (!this.paletteEditor.wallpaperPath) {
                this._showToast('Please select a wallpaper first');
                return;
            }

            try {
                this.themeExporter.export(
                    this.colorRoles,
                    this.paletteEditor.wallpaperPath
                );
                this._showToast('Theme exported successfully');
            } catch (e) {
                this._showToast(`Export failed: ${e.message}`);
                console.error('Export error:', e);
            }
        }

        _applyTheme() {
            const backend = this.settingsManager.get('colorBackend');

            if (!this.paletteEditor.wallpaperPath) {
                this._showToast('Please select a wallpaper first');
                return;
            }

            if (backend === 'matugen') {
                runMatugen(
                    this.paletteEditor.wallpaperPath,
                    () => {
                        const posthookScript = this.settingsManager.get('posthookScript');
                        if (posthookScript && posthookScript.trim()) {
                            try {
                                GLib.spawn_async(
                                    null,
                                    [posthookScript, 'matugen', this.paletteEditor.wallpaperPath],
                                    null,
                                    GLib.SpawnFlags.SEARCH_PATH,
                                    null
                                );
                            } catch (e) {
                                console.error(`Error executing posthook: ${e.message}`);
                            }
                        }
                        this._showToast('Theme applied successfully with Matugen');
                    },
                    error => {
                        this._showToast(`Matugen failed: ${error.message}`);
                        console.error('Matugen error:', error);
                    }
                );
            } else {
                if (!this.colorRoles) {
                    this._showToast('Please extract colors first');
                    return;
                }

                try {
                    const success = this.configWriter.applyTheme(
                        this.colorRoles,
                        this.paletteEditor.wallpaperPath,
                        {}
                    );

                    if (success) {
                        this._showToast('Theme applied successfully');
                    } else {
                        this._showToast('Theme application failed');
                    }
                } catch (e) {
                    this._showToast(`Apply failed: ${e.message}`);
                    console.error('Apply error:', e);
                }
            }
        }

        _resetApplication() {
            this.paletteEditor.reset();
            this.colorRoles = null;
            this._showToast('Application reset');
        }

        _showToast(message) {
            const toast = new Adw.Toast({
                title: message,
                timeout: 2,
            });
            this.toastOverlay.add_toast(toast);
        }

        _showSettings() {
            const dialog = new SettingsDialog(this, this.settingsManager);
            dialog.connect('close-request', () => {
                this.paletteEditor._wallpaperSection.updateButtonVisibility();
                this.actionBar._updateButtonVisibility();
                return false;
            });
            dialog.present();
        }
    }
);

const app = new TinteApplication();
app.run(ARGV);
