/**
 * WTMB (Window Thumbnails)
 * optionsFactory.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2024
 * @license    GPL-3.0
 */

'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

let Me;

// gettext
let _;

export function init(me) {
    Me = me;
    _ = Me._;
}

export const ItemFactory = class {
    constructor() {
        this._settings = Me.opt._gSettings;
    }

    getRowWidget(text, caption, widget, variable, options = [], dependsOn) {
        let item = [];
        let label;
        if (widget) {
            label = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
            });
            const option = new Gtk.Label({
                halign: Gtk.Align.START,
            });
            option.set_text(text);
            label.append(option);

            if (caption) {
                const captionLabel = new Gtk.Label({
                    halign: Gtk.Align.START,
                    wrap: true,
                    /* width_chars: 80, */
                    xalign: 0,
                });
                const context = captionLabel.get_style_context();
                context.add_class('dim-label');
                context.add_class('caption');
                captionLabel.set_text(caption);
                label.append(captionLabel);
            }
            label._title = text;
        } else {
            label = text;
        }
        item.push(label);
        item.push(widget);

        let key;

        if (variable && Me.opt.options[variable]) {
            const opt = Me.opt.options[variable];
            key = opt[1];
        }

        if (widget?.connectToOpt) {
            widget.connectToOpt(widget, key, variable, options);

            if (dependsOn) {
                const dKey = Me.opt.options[dependsOn][1];
                this._settings.bind(dKey, widget, 'sensitive', Gio.SettingsBindFlags.GET);
            }
        }

        return item;
    }

    _connectSwitch(widget, key /* , variable */) {
        this._settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectSpinButton(widget, key /* , variable */) {
        this._settings.bind(key, widget.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectEntry(widget, key, variable) {
        if (widget._editable) {
            this._settings.bind(key, widget, 'text', Gio.SettingsBindFlags.DEFAULT);

            widget.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
            widget.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);
            widget.connect('icon-press', e => {
                if (e.get_text() === '')
                    e.set_text(Me.opt.getDefault(variable));
                else
                    e.set_text('');
            });
        } else {
            widget.width_chars = 25;
            widget.set_text(Me.opt.get(variable));
            widget.editable = false;
            widget.can_focus = false;
        }
    }

    _connectDropDown(widget, key, variable, options) {
        const model = widget.get_model();
        const currentValue = Me.opt.get(variable);
        for (let i = 0; i < options.length; i++) {
            const text = options[i][0];
            const id = options[i][1];
            model.append(new DropDownItem({ text, id }));
            if (id === currentValue)
                widget.set_selected(i);
        }

        const factory = new Gtk.SignalListItemFactory();
        factory.connect('setup', (fact, listItem) => {
            const label = new Gtk.Label({ xalign: 0 });
            listItem.set_child(label);
        });
        factory.connect('bind', (fact, listItem) => {
            const label = listItem.get_child();
            const item = listItem.get_item();
            label.set_text(item.text);
        });

        widget.connect('notify::selected-item', dropDown => {
            const item = dropDown.get_selected_item();
            Me.opt.set(variable, item.id);
        });

        Me.opt.connect(`changed::${key}`, () => {
            const newId = Me.opt.get(variable, true);
            for (let i = 0; i < options.length; i++) {
                const id = options[i][1];
                if (id === newId)
                    widget.set_selected(i);
            }
        });

        widget.set_factory(factory);
    }

    _isValidAccel(mask, keyval) {
        return Gtk.accelerator_valid(keyval, mask) || (keyval === Gdk.KEY_Tab && mask !== 0);
    }

    _isValidBinding(mask, keycode, keyval) {
        return !(mask === 0 && !(keyval >= Gdk.KEY_F1 && keyval <= Gdk.KEY_F12) ||
            (mask === Gdk.ModifierType.SHIFT_MASK &&
                keycode !== 0 &&
                ((keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z) ||
                 (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z) ||
                 (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9) ||
                 (keyval >= Gdk.KEY_kana_fullstop && keyval <= Gdk.KEY_semivoicedsound) ||
                 (keyval >= Gdk.KEY_Arabic_comma && keyval <= Gdk.KEY_Arabic_sukun) ||
                 (keyval >= Gdk.KEY_Serbian_dje && keyval <= Gdk.KEY_Cyrillic_HARDSIGN) ||
                 (keyval >= Gdk.KEY_Greek_ALPHAaccent && keyval <= Gdk.KEY_Greek_omega) ||
                 (keyval >= Gdk.KEY_hebrew_doublelowline && keyval <= Gdk.KEY_hebrew_taf) ||
                 (keyval >= Gdk.KEY_Thai_kokai && keyval <= Gdk.KEY_Thai_lekkao) ||
                 (keyval >= Gdk.KEY_Hangul_Kiyeog && keyval <= Gdk.KEY_Hangul_J_YeorinHieuh) ||
                 (keyval === Gdk.KEY_space && mask === 0) ||
                 this._keyvalIsForbidden(keyval))));
    }

    _keyvalIsForbidden(keyval) {
        return [
            Gdk.KEY_Home,
            Gdk.KEY_Left,
            Gdk.KEY_Up,
            Gdk.KEY_Right,
            Gdk.KEY_Down,
            Gdk.KEY_Page_Up,
            Gdk.KEY_Page_Down,
            Gdk.KEY_End,
            Gdk.KEY_Tab,
            Gdk.KEY_KP_Enter,
            Gdk.KEY_Return,
            Gdk.KEY_Mode_switch,
        ].includes(keyval);
    }

    _getAccel(variable) {
        return `${Me.opt.get(variable, true)[0] || ''}`;
    }

    _connectShortcutButton(widget, key, variable) {
        const shortcutLabel = widget.child;
        try {
            shortcutLabel.set_accelerator(`${this._getAccel(variable)}`);
        } catch {
            console.error(`[${Me.metadata.name}]: Error while parsing shortcut from settings, resetting to default`);
            Me.opt.set(variable, Me.opt.getDefault(variable));
        }
        Me.opt.connect(`changed::${key}`, () => {
            shortcutLabel.set_accelerator(`${this._getAccel(variable)}`);
        });

        widget.connect('clicked', () => {
            const ctlw = new Gtk.EventControllerKey();
            /* const content = new Adw.StatusPage({
                title: _('Set shortcut'),
                icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
            });*/
            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                homogeneous: false,
                hexpand: true,
                vexpand: true,
                margin_top: 20,
                margin_start: 20,
                margin_end: 20,
                spacing: 30,
            });

            const title = new Gtk.Label({
                label: _('<b>Enter new shortcut</b>'),
                use_markup: true,
            });

            const image = Gtk.Picture.new_for_file(Gio.File.new_for_path(`${Me.path}/enter-keyboard-shortcut.svg`));
            image.hexpand = false;
            image.vexpand = false;
            image.margin_start = 60;
            image.margin_end = 60;
            image.can_shrink = false;

            const label = new Gtk.Label({
                label: _('Press Esc to cancel or Backspace to disable the keyboard shortcut'),
            });
            const context = label.get_style_context();
            context.add_class('dim-label');

            content.append(title);
            content.append(image);
            content.append(label);

            const editor = new Adw.Window({
                modal: true,
                transient_for: Me.window,
                hide_on_close: true,
                width_request: 320,
                height_request: 240,
                resizable: false,
                content,
            });
            editor.add_controller(ctlw);
            ctlw.connect('key-pressed', (eventControllerKey, keyval, keycode, state) => {
                let mask = state & Gtk.accelerator_get_default_mod_mask();
                mask &= ~Gdk.ModifierType.LOCK_MASK;
                if (!mask && keyval === Gdk.KEY_Escape) {
                    editor.close();
                    return Gdk.EVENT_STOP;
                }

                if (!mask && keyval === Gdk.KEY_BackSpace) {
                    editor.close();
                    Me.opt.set(variable, []);
                    return Gdk.EVENT_STOP;
                }

                if (!this._isValidBinding(mask, keycode, keyval) || !this._isValidAccel(mask, keyval))
                    return Gdk.EVENT_STOP;

                Me.opt.set(variable, [Gtk.accelerator_name_with_keycode(null, keyval, keycode, mask)]);
                editor.destroy();
                return Gdk.EVENT_STOP;
            });
            editor.present();
        });
    }

    newSwitch() {
        let sw = new Gtk.Switch({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        sw.connectToOpt = this._connectSwitch.bind(this);
        // sw._isSwitch = true;
        return sw;
    }

    newSpinButton(adjustment) {
        let spinButton = new Gtk.SpinButton({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            vexpand: false,
            xalign: 0.5,
        });
        spinButton.set_adjustment(adjustment);
        spinButton.connectToOpt = this._connectSpinButton.bind(this);
        // spinButton._isSpinButton = true;
        return spinButton;
    }

    newDropDown() {
        const dropDown = new Gtk.DropDown({
            model: new Gio.ListStore({
                item_type: DropDownItem,
            }),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        dropDown.connectToOpt = this._connectDropDown.bind(this);
        // dropDown._isDropDown = true;
        return dropDown;
    }

    newScale(adjustment) {
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            draw_value:  true,
            has_origin:  false,
            value_pos:   Gtk.PositionType.LEFT,
            digits:      0,
            halign:      Gtk.Align.END,
            valign:      Gtk.Align.CENTER,
            hexpand:     true,
            vexpand:     false,
        });
        scale.set_size_request(300, -1);
        scale.set_adjustment(adjustment);
        // scale._isScale = true;
        scale.connectToOpt = this._connectSpinButton.bind(this);
        return scale;
    }

    newLabel(text = '') {
        const label = new Gtk.Label({
            label: text,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        label._activatable = false;
        return label;
    }

    newEditableEntry() {
        const entry = new Gtk.Entry({
            width_chars: 15,
            max_width_chars: 15,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            xalign: 0.5,
        });
        entry._editable = true;
        entry.connectToOpt = this._connectEntry.bind(this);
        // entry._isEntry = true;
        return entry;
    }

    newLinkButton(uri) {
        const linkBtn = new Gtk.LinkButton({
            uri,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            icon_name: 'emblem-symbolic-link',
        });
        return linkBtn;
    }

    newButton() {
        const btn = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });

        btn._activatable = true;
        return btn;
    }

    newPresetButton(opt, profileIndex) {
        const load = opt.loadProfile.bind(opt);
        const save = opt.storeProfile.bind(opt);
        const reset = opt.resetProfile.bind(opt);

        const box = new Gtk.Box({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            spacing: 8,
        });
        box.is_profile_box = true;

        const entry = new Gtk.Entry({
            width_chars: 40,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            xalign: 0,
        });
        entry.set_text(opt.get(`profileName${profileIndex}`));
        entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
        entry.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);

        const resetProfile = this.newButton();
        resetProfile.set({
            tooltip_text: _('Reset profile to defaults'),
            icon_name: 'document-revert-symbolic',
            hexpand: false,
            css_classes: ['destructive-action'],
        });

        function setName() {
            const ProfileNames = [
                _('GNOME 3'),
                _('GNOME 40+ - Bottom Hot Edge'),
                _('Hot Corner Centric - Top Left Hot Corner'),
                _('Dock Overview - Bottom Hot Edge'),
            ];

            let name = opt.get(`profileName${profileIndex}`, true);
            if (!name)
                name = ProfileNames[profileIndex - 1];
            entry.set_text(name);
        }

        setName();

        entry.connect('icon-press', e => e.set_text(''));
        entry.connect('changed', e => opt.set(`profileName${profileIndex}`, e.get_text()));

        resetProfile.connect('clicked', () => {
            reset(profileIndex);
            setName();
        });
        resetProfile._activatable = false;

        const loadProfile = this.newButton();
        loadProfile.set({
            tooltip_text: _('Load profile'),
            icon_name: 'view-refresh-symbolic',
            hexpand: false,
        });
        loadProfile.connect('clicked', () => load(profileIndex));
        loadProfile._activatable = false;

        const saveProfile = this.newButton();
        saveProfile.set({
            tooltip_text: _('Save current settings into this profile'),
            icon_name: 'document-save-symbolic',
            hexpand: false,
        });
        saveProfile.connect('clicked', () => save(profileIndex));
        saveProfile._activatable = false;

        box.append(resetProfile);
        box.append(entry);
        box.append(saveProfile);
        box.append(loadProfile);
        return box;
    }

    newResetButton(callback) {
        const btn = this.newButton();
        btn.set({
            css_classes: ['destructive-action'],
            icon_name: 'edit-delete-symbolic',
        });

        btn.connect('clicked', callback);
        btn._activatable = false;
        return btn;
    }

    newOptionsResetButton() {
        const btn = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            css_classes: ['destructive-action'],
            icon_name: 'document-revert-symbolic',
        });

        btn.connect('clicked', () => {
            const settings = this._settings;
            settings.list_keys().forEach(
                key => settings.reset(key)
            );
        });
        btn._activatable = false;
        return btn;
    }

    newShortcutButton() {
        const btn = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        const shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: _('Disabled'),
            // accelerator: opt.get('create-shortcut'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        btn.set_child(shortcutLabel);
        btn.connectToOpt = this._connectShortcutButton.bind(this);

        return btn;
    }
};

export class AdwPrefs {
    constructor(gOptions) {
        Me.opt = gOptions;
    }

    getFilledWindow(window, pages) {
        for (let page of pages) {
            const title = page.title;
            const iconName = page.iconName;
            const optionList = page.optionList;

            window.add(
                this._getAdwPage(optionList, {
                    title,
                    icon_name: iconName,
                })
            );
        }

        window.set_search_enabled(true);

        return window;
    }

    _getAdwPage(optionList, pageProperties = {}) {
        // pageProperties.width_request = 740;
        const page = new Adw.PreferencesPage(pageProperties);
        let group;
        for (let item of optionList) {
            // label can be plain text for Section Title
            // or GtkBox for Option
            const option = item[0];
            const widget = item[1];
            if (!widget) {
                if (group)
                    page.add(group);

                group = new Adw.PreferencesGroup({
                    title: option,
                    hexpand: true,
                    width_request: 700,
                });
                continue;
            }

            const row = new Adw.ActionRow({
                title: option._title,
            });

            const grid = new Gtk.Grid({
                column_homogeneous: false,
                column_spacing: 20,
                margin_start: 8,
                margin_end: 8,
                margin_top: 8,
                margin_bottom: 8,
                hexpand: true,
            });
            /* for (let i of item) {
                box.append(i);*/
            grid.attach(option, 0, 0, 1, 1);
            if (widget)
                grid.attach(widget, 1, 0, 1, 1);

            row.set_child(grid);
            if (widget._activatable === false)
                row.activatable = false;
            else
                row.activatable_widget = widget;

            group.add(row);
        }
        page.add(group);
        return page;
    }
}

const DropDownItem = GObject.registerClass({
    // Registered name should be unique
    GTypeName: `DropDownItem${Math.floor(Math.random() * 1000)}`,
    Properties: {
        'text': GObject.ParamSpec.string(
            'text',
            'Text',
            'DropDown item text',
            GObject.ParamFlags.READWRITE,
            ''
        ),
        'id': GObject.ParamSpec.int(
            'id',
            'Id',
            'Item id stored in settings',
            GObject.ParamFlags.READWRITE,
            // min, max, default
            -2147483648, 2147483647, 0
        ),
    },
}, class DropDownItem extends GObject.Object {
    get text() {
        return this._text;
    }

    set text(text) {
        this._text = text;
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }
});
