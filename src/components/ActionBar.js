import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { SignalManager } from '../utils/SignalManager.js';

export const ActionBar = GObject.registerClass(
    {
        Signals: {
            'export-theme': {},
            reset: {},
            back: {},
            'apply-theme': {},
        },
    },
    class ActionBar extends Gtk.ActionBar {
        _init(settingsManager) {
            super._init({
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 6,
                margin_end: 6,
            });

            this.settingsManager = settingsManager;
            this._signals = new SignalManager();

            this._initializeButtons();

            this.connect('unrealize', () => {
                this._signals.disconnectAll();
            });
        }

        _initializeButtons() {
            const backend = this.settingsManager.get('colorBackend');

            this._exportButton = new Gtk.Button({
                label: 'Export Theme',
                tooltip_text: 'Export theme to dotfiles structure',
                visible: backend !== 'matugen',
            });
            this._signals.connect(this._exportButton, 'clicked', () => this.emit('export-theme'));
            this.pack_start(this._exportButton);

            const applyButton = new Gtk.Button({
                label: 'Apply Theme',
                css_classes: ['suggested-action'],
                tooltip_text: 'Apply theme to system',
            });
            this._signals.connect(applyButton, 'clicked', () => this.emit('apply-theme'));
            this.pack_end(applyButton);

            const resetButton = new Gtk.Button({
                label: 'Reset',
                css_classes: ['destructive-action'],
                tooltip_text: 'Reset application state',
            });
            this._signals.connect(resetButton, 'clicked', () => this.emit('reset'));
            this.pack_start(resetButton);

            this._backButton = new Gtk.Button({
                label: 'Back',
                tooltip_text: 'Go back to wallpaper browser',
                visible: false,
            });
            this._signals.connect(this._backButton, 'clicked', () => this.emit('back'));
            this.pack_end(this._backButton);
        }

        _updateButtonVisibility() {
            const backend = this.settingsManager.get('colorBackend');
            this._exportButton.set_visible(backend !== 'matugen');
        }

        setBackVisible(visible) {
            this._backButton.set_visible(visible);
        }
    }
);
