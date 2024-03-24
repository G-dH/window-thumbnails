/**
 * WTMB (Window Thumbnails)
 * settings.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2024
 * @license    GPL-3.0
 */

'use strict';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export const Options = class {
    constructor(me) {
        this.Me = me;

        this._gSettings = this.Me.gSettings;

        this._connectionIds = [];
        this._writeTimeoutId = 0;
        this._gSettings.delay();
        this.connect('changed', () => {
            if (this._writeTimeoutId)
                GLib.Source.remove(this._writeTimeoutId);

            this._writeTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                400,
                () => {
                    this._gSettings.apply();
                    this._updateCachedSettings();
                    this._writeTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });

        this.options = {
            limitNumber:               ['int',  'limit-number'],
            defaultScale:              ['int',  'default-scale'],
            defaultOpacity:            ['int',  'default-opacity'],
            scaleAxis:                 ['int',  'scale-axis'],
            mouseHoverAction:          ['int',  'mouse-hover-action'],
            mouseHoverDelay:           ['int',  'mouse-hover-delay'],
            positionCustom:            ['boolean',  'position-custom'],
            horizontalPosition:        ['int',  'horizontal-position'],
            verticalPosition:          ['int',  'vertical-position'],
            animationTime:             ['int',  'animation-time'],
            rememberGeometry:          ['boolean',  'remember-geometry'],
            showCloseButton:           ['boolean',  'show-close-button'],
            hideFocused:               ['boolean',  'hide-focused'],
            disableMetaUnredirection:  ['boolean',  'disable-meta-unredirection'],

            createTmbShortcut:         ['strv', 'create-tmb-shortcut'],
            minimizeToTmbShortcut:     ['strv', 'minimize-to-tmb-shortcut'],
            removeLastShortcut:        ['strv', 'remove-last-tmb-shortcut'],
            removeAllShortcut:         ['strv', 'remove-all-tmb-shortcut'],
            toggleVisibilityShortcut:  ['strv', 'toggle-visibility-shortcut'],
            switchSourceNextShortcut:  ['strv', 'switch-source-next-shortcut'],
            switchSourcePrevShortcut:  ['strv', 'switch-source-prev-shortcut'],

            doubleClickAction:         ['int', 'double-click-action'],
            midBtnAction:              ['int', 'middle-btn-action'],
            secBtnAction:              ['int', 'sec-btn-action'],
            ctrlPrimBtnAction:         ['int', 'ctrl-prim-btn-action'],
            ctrlSecBtnAction:          ['int', 'ctrl-sec-btn-action'],
            scrollAction:              ['int', 'scroll-action'],
            ctrlScrollAction:          ['int', 'ctrl-scroll-action'],
            shiftScrollAction:         ['int', 'shift-scroll-action'],
        };

        this.cachedOptions = {};

        try {
            this._migrateSettingsToFixedSchemaPath();
        } catch {
            console.error('Migration of the schema failed');
        }

        this._setOptionConstants();
    }

    _migrateSettingsToFixedSchemaPath() {
        if (!this.Me.extension || this._gSettings.get_boolean('schema-migrated'))
            return;

        const oldSettings = this._getOldSettings();
        Object.keys(this.options).forEach(option => {
            const value = this.get(option, false, oldSettings);
            if (value !== this.getDefault(option))
                this.set(option, value);
        });

        this._gSettings.set_boolean('schema-migrated', true);
        oldSettings.list_keys().forEach(
            key => oldSettings.reset(key)
        );
    }

    _updateCachedSettings(/* settings, key */) {
        Object.keys(this.options).forEach(v => this.get(v, true));
        this._setOptionConstants();
    }

    get(option, updateCache = false, customSettings) {
        // customSettings is temporary solution for schema path migration
        const gSettings = customSettings || this._gSettings;

        if (this.options[option] === undefined)
            console.log(`[${this.Me.metadata.name}] Error: Option "${option}" not found`);

        if (updateCache || this.cachedOptions[option] === undefined) {
            let [, key] = this.options[option];
            this.cachedOptions[option] = gSettings.get_value(key).deep_unpack();
        }

        return this.cachedOptions[option];
    }

    set(option, value) {
        const [format, key] = this.options[option];
        switch (format) {
        case 'strv':
            this._gSettings.set_strv(key, value);
            break;
        case 'string':
            this._gSettings.set_string(key, value);
            break;
        case 'int':
            this._gSettings.set_int(key, value);
            break;
        case 'boolean':
            this._gSettings.set_boolean(key, value);
            break;
        }
    }

    getDefault(option) {
        const [, key] = this.options[option];
        return this._gSettings.get_default_value(key).deep_unpack();
    }

    connect(name, callback) {
        const id = this._gSettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gSettings.disconnect(id));
        if (this._writeTimeoutId)
            GLib.Source.remove(this._writeTimeoutId);
        this._writeTimeoutId = 0;
        this._gSettings = null;
    }

    _setOptionConstants() {
        this.DEFAULT_SCALE = this.get('defaultScale') / 100;
        this.SCALE_AXIS_VERTICAL = !this.get('scaleAxis');
        this.HOVER_ACTION = this.get('mouseHoverAction');
        this.HOVER_SHOW_PREVIEW = this.HOVER_ACTION === 1;
        this.HOVER_HIDE_TMB = this.HOVER_ACTION === 2;
        this.HOVER_DELAY = this.get('mouseHoverDelay');
        this.DEFAULT_OPACITY = 2.55 * this.get('defaultOpacity');
        this.POSITION_CUSTOM = this.get('positionCustom');
        this.H_POSITION = this.get('horizontalPosition') / 100;
        this.V_POSITION = this.get('verticalPosition') / 100;
        this.LIMIT_TO_ONE = !!this.get('limitNumber');
        this.ANIMATION_TIME = this.get('animationTime');
        this.REMEMBER_GEOMETRY = this.get('rememberGeometry');
        this.SHOW_CLOSE_BUTTON = this.get('showCloseButton');
        this.HIDE_FOCUSED = this.get('hideFocused');
        this.DISABLE_UNREDIRECTION = this.get('disableMetaUnredirection');
    }

    // Allows connection to the previous settings path with a typo so the settings can be migrated to the fixed path
    // Will be deleted in the next version
    _getOldSettings() {
        const schema = 'org.gnome.shell.extensions.window-thumbnails-old';
        const path = '/org/gnome/shell/extensions/window-thumnails/';
        const schemaDir = this.Me.extension.dir.get_child('schemas');
        let schemaSource;
        if (schemaDir.query_exists(null)) {
            schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                schemaDir.get_path(),
                Gio.SettingsSchemaSource.get_default(),
                false
            );
        } else {
            console.error('Source schema not found');
            return null;
        }

        const schemaObj = schemaSource.lookup(schema, true);
        if (!schemaObj) {
            log(
                `Old schema ${schema} could not be found for extension ${
                    this.Me.metadata.uuid}. Please check your installation.`
            );
            return null;
        }

        return new Gio.Settings({ settings_schema: schemaObj, path });
    }
};
