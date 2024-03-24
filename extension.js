/**
 * WTMB (Window Thumbnails)
 * extension.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2024
 * @license    GPL-3.0
  */

'use strict';

import GLib from 'gi://GLib';

import * as Extension from 'resource:///org/gnome/shell/extensions/extension.js';

// Me imports
import * as Settings from './settings.js';
import { WinTmb } from './winTmb.js';
import * as Keybindings from './keybindings.js';
import * as Util from './util.js';

export default class WTMB extends Extension.Extension {
    enable() {
        const Me = {};
        Me.extension = this;
        Me.metadata = this.metadata;
        Me.gSettings = this.getSettings();
        Me._ = this.gettext.bind(this);
        Me.Util = Util;
        Util.init(Me);

        Me.opt = new Settings.Options(Me);

        this.Me = Me;

        this._winTmb = new WinTmb(Me);

        Me.opt.connect('changed', (settings, key) => {
            if (key.includes('shortcut'))
                this._updateKeyBinding();
        });

        // Delay keybinding so it doesn't affect screen unlocking animation
        this._keyBindDelayId = GLib.timeout_add(
            GLib.PRIORITY_LOW, 400,
            () => {
                this._updateKeyBinding();
                this._keyBindDelayId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );

        // Restore thumbnails if needed
        this._winTmb.restoreThumbnails();

        console.debug(`${this.metadata.name}: enabled`);
    }

    disable() {
        if (this._keyBindDelayId) {
            GLib.source_remove(this._keyBindDelayId);
            this._keyBindDelayId = 0;
        }

        if (this._keybindingsManager) {
            this._keybindingsManager.destroy();
            this._keybindingsManager = null;
        }

        this._winTmb.destroy();
        this.Me.opt.destroy();
        this.Me.opt = null;
        this.Me.Util.cleanGlobals();
        this.Me = null;
        this._winTmb = null;

        console.debug(`${this.metadata.name}: disabled`);
    }

    _getKeybindingsManager() {
        if (!this._keybindingsManager)
            this._keybindingsManager = new Keybindings.Manager();
        return this._keybindingsManager;
    }

    _updateKeyBinding() {
        const manager = this._getKeybindingsManager();
        manager.removeAll();
        this._bindShortcuts();
    }

    _bindShortcuts() {
        if (!this._gSettingsKBid)
            this._gSettingsKBid = this.Me.opt.connect('changed::create-tmb-shortcut', this._updateKeyBinding.bind(this));

        const shortcuts = [
            {
                keyVar: 'createTmbShortcut',
                callback: () => this._winTmb.createThumbnail(),
            },
            {
                keyVar: 'minimizeToTmbShortcut',
                callback: () => this._winTmb.minimizeToThumbnail(),
            },
            {
                keyVar: 'removeLastShortcut',
                callback: () => this._winTmb.removeLast(),
            },
            {
                keyVar: 'removeAllShortcut',
                callback: () => this._winTmb.removeAll(),
            },
            {
                keyVar: 'toggleVisibilityShortcut',
                callback: () => this._winTmb.toggleShowAll(),
            },
            {
                keyVar: 'switchSourceNextShortcut',
                callback: () => this._winTmb.switchSourceNext(),
            },
            {
                keyVar: 'switchSourcePrevShortcut',
                callback: () => this._winTmb.switchSourcePrev(),
            },
        ];

        const manager = this._getKeybindingsManager();

        for (const shortcut of shortcuts) {
            const keyVar = shortcut.keyVar;
            const accel = this.Me.opt.get(keyVar, true)[0];
            const callback = shortcut.callback;

            if (accel && accel !== '')
                manager.add(accel, keyVar, callback);
        }
    }
}
