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
            midBtnAction:           ['int', 'middle-btn-action'],
            secBtnAction:              ['int', 'sec-btn-action'],
            ctrlPrimBtnAction:         ['int', 'ctrl-prim-btn-action'],
            ctrlSecBtnAction:          ['int', 'ctrl-sec-btn-action'],
            scrollAction:              ['int', 'scroll-action'],
            ctrlScrollAction:          ['int', 'ctrl-scroll-action'],
            shiftScrollAction:         ['int', 'shift-scroll-action'],
        };

        this.cachedOptions = {};

        this._setOptionConstants();
    }

    _updateCachedSettings(/* settings, key */) {
        Object.keys(this.options).forEach(v => this.get(v, true));
        this._setOptionConstants();
    }

    get(option, updateCache = false) {
        if (this.options[option] === undefined)
            console.log(`[${this.Me.metadata.name}]: Error: Option "${option}" not found`);

        if (updateCache || this.cachedOptions[option] === undefined) {
            const [, key, settings] = this.options[option];
            let gSettings;
            if (settings !== undefined)
                gSettings = settings();
            else
                gSettings = this._gSettings;


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
};
