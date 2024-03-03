/**
 * WTMB (Window Thumbnails)
 * extension.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2024
 * @license    GPL-3.0
 */

'use strict';

const { GLib } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const MyExtension = ExtensionUtils.getCurrentExtension();
const WinTmbModule = MyExtension.imports.winTmb.WinTmbModule;
const Settings = MyExtension.imports.settings;
const Util = MyExtension.imports.util;
const Keybindings = MyExtension.imports.keybindings;

function init() {
    ExtensionUtils.initTranslations();
    return new WTMB();
}

class WTMB {
    enable() {
        const Me = {};

        this.metadata = MyExtension.metadata;
        Me.metadata = MyExtension.metadata;
        Me.gSettings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
        Me.Util = Util;
        Me.Util.init(Me);
        Me._ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

        Me.opt = new Settings.Options(Me);

        this.Me = Me;

        this._wt = new WinTmbModule(Me);
        this._wt.update();

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

        this._wt.update(true);
        this._wt.cleanGlobals();
        this.Me.opt.destroy();
        this.Me.opt = null;
        this.Me.Util.cleanGlobals();
        this.Me = null;
        this._wt = null;

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
                callback: () => {
                    const metaWin = global.display.get_tab_list(0, null)[0];
                    return this._wt.createThumbnail(metaWin);
                },
            },
            {
                keyVar: 'minimizeToTmbShortcut',
                callback: () => this._wt.minimizeToThumbnail(),
            },
            {
                keyVar: 'removeLastShortcut',
                callback: () => this._wt.removeLast(),
            },
            {
                keyVar: 'removeAllShortcut',
                callback: () => this._wt.removeAll(),
            },
            {
                keyVar: 'toggleVisibilityShortcut',
                callback: () => this._wt.toggleShowAll(),
            },
            {
                keyVar: 'switchSourceNextShortcut',
                callback: () => this._wt.switchSourceNext(),
            },
            {
                keyVar: 'switchSourcePrevShortcut',
                callback: () => this._wt.switchSourcePrev(),
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
