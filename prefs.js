/**
 * WTMB (Window Thumbnails)
 * prefs.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2024
 * @license    GPL-3.0
 */

'use strict';

import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Settings from './settings.js';
import * as OptionsFactory from './optionsFactory.js';

// gettext
let _;

export default class WTMB extends ExtensionPreferences {
    _getPageList() {
        const itemFactory = new OptionsFactory.ItemFactory();
        const pageList = [
            {
                title: _('Geometry'),
                iconName: 'preferences-desktop-display-symbolic',
                optionList: this._getGeometryOptionList(itemFactory),
            },
            {
                title: _('Behavior'),
                iconName: 'system-run-symbolic',
                optionList: this._getBehaviorOptionList(itemFactory),
            },
            {
                title: _('Controls'),
                iconName: 'media-playback-start-symbolic',
                optionList: this._getContentOptionList(itemFactory),
            },
            {
                title: _('Shortcuts'),
                iconName: 'preferences-desktop-keyboard-shortcuts-symbolic',
                optionList: this._getKeybindingsOptionList(itemFactory),
            },
            {
                title: _('Mouse'),
                iconName: 'input-mouse-symbolic',
                optionList: this._getMouseOptionList(itemFactory),
            },
            {
                title: _('About'),
                iconName: 'preferences-system-details-symbolic',
                optionList: this._getAboutOptionList(itemFactory),
            },
        ];

        return pageList;
    }

    fillPreferencesWindow(window) {
        const Me = {};
        Me.gSettings = this.getSettings();
        Me._ = this.gettext.bind(this);
        _ = Me._;
        Me.metadata = this.metadata;
        Me.path = this.path;
        Me.window = window;

        this.opt = new Settings.Options(Me);
        Me.opt = this.opt;

        OptionsFactory.init(Me);

        this.Me = Me;

        window = new OptionsFactory.AdwPrefs(this.opt).getFilledWindow(window, this._getPageList());
        window.connect('close-request', () => {
            this.opt.destroy();
            this.opt = null;
            this.Me = null;
            _ = null;
        });

        window.set_default_size(840, 800);
    }


    // ////////////////////////////////////////////////////////////////////

    _getBehaviorOptionList(itemFactory) {
        const optionList = [];

        optionList.push(
            itemFactory.getRowWidget(
                /* _('Behavior')*/
                ''
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Maximum Number Of Thumbnails'),
                _('Limit the number of thumbnails to one if you do not need more and want to simplify control. In this case, creating a new thumbnail removes the existing one. This limit does not apply to the "Minimize to thumbnail" action'),
                itemFactory.newDropDown(),
                'limitNumber',
                [
                    [_('Unlimited'), 0],
                    [_('Only One'), 1],
                ]
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Mouse Hover Action'),
                _('Choose how the thumbnail should behave when hovered by the mouse pointer. The "Show Full Size Preview" option can also be toggled by right-clicking on the thumbnail. To prevent the execution of the selected action, hold down the Alt key while hovering the mouse pointer over the thumbnail'),
                itemFactory.newDropDown(),
                'mouseHoverAction',
                [
                    [_('No Action'), 0],
                    [_('Show Full Size Preview'), 1],
                    [_('Hide'), 2],
                ]
            )
        );

        let hoverDelayAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 1000,
            step_increment: 10,
            page_increment: 100,
        });

        optionList.push(
            itemFactory.getRowWidget(
                _('Mouse Hover Action Delay'),
                _('Adjusts the delay before the selected action is performed. This delay allows you to drag the thumbnail to another position before it is hidden or a full-size preview is created'),
                itemFactory.newSpinButton(hoverDelayAdjustment),
                'mouseHoverDelay'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Hide On Source Window Focus'),
                _('Hide thumbnail if its source window gets focus'),
                itemFactory.newSwitch(),
                'hideFocused'
            )
        );

        let animationTimeAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 1000,
            step_increment: 10,
            page_increment: 100,
        });

        const animationTimeScale = itemFactory.newScale(animationTimeAdjustment);
        animationTimeScale.add_mark(400, Gtk.PositionType.TOP, null);

        optionList.push(
            itemFactory.getRowWidget(
                _('Animation Time (ms)'),
                _('Adjusts speed of transition animations'),
                animationTimeScale,
                'animationTime'
            )
        );

        let tmbOpacityAdjustment = new Gtk.Adjustment({
            lower: 10,
            upper: 100,
            step_increment: 10,
            page_increment: 20,
        });

        optionList.push(
            itemFactory.getRowWidget(
                _('Thumbnail Opacity'),
                _('Adjusts the default thumbnail opacity. You can modify the opacity at any time using a shortcut (default Shift + Scroll) while hovering the thumbnail'),
                itemFactory.newSpinButton(tmbOpacityAdjustment),
                'defaultOpacity'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Keep Thumbnails Visible In Fullscreen Mode'),
                _('In fullscreen mode, GNOME Shell bypasses the compositor to improve the performance of fullscreen apps like games, which results in the disappearance of the window thumbnails'),
                itemFactory.newSwitch(),
                'disableMetaUnredirection'
            )
        );

        return optionList;
    }
    // -----------------------------------------------------

    _getGeometryOptionList(itemFactory) {
        const optionList = [];

        optionList.push(
            itemFactory.getRowWidget(
                _('Default Size')
            )
        );

        let tmbScaleAdjustment = new Gtk.Adjustment({
            lower: 5,
            upper: 100,
            step_increment: 1,
            page_increment: 10,
        });

        optionList.push(
            itemFactory.getRowWidget(
                _('Thumbnail Scale'),
                _('The size of the thumbnail in the selected axis relative to the screen width or height (set below)'),
                itemFactory.newSpinButton(tmbScaleAdjustment),
                'defaultScale'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Scale Axis'),
                _('Choose whether the scale should be applied to the height or width of the thumbnail. The original aspect ratio will be preserved'),
                itemFactory.newDropDown(),
                'scaleAxis',
                [
                    [_('Height'), 0],
                    [_('Width'), 1],
                ]
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Default Position')
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Custom Position'),
                _('Set a custom default position for the new thumbnail on the screen, or allow it to display at the mouse pointer position. You can then drag and drop the thumbnail anywhere on the screen whenever you want'),
                itemFactory.newSwitch(),
                'positionCustom'
            )
        );

        let horizontalPositionAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 100,
            step_increment: 1,
            page_increment: 10,
        });

        optionList.push(
            itemFactory.getRowWidget(
                _('Horizontal Position'),
                _('Adjusts the horizontal position of the new thumbnail as a percentage of the screen width from the left'),
                itemFactory.newScale(horizontalPositionAdjustment),
                'horizontalPosition',
                null,
                'positionCustom'
            )
        );

        let verticalPositionAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 100,
            step_increment: 1,
            page_increment: 10,
        });

        optionList.push(
            itemFactory.getRowWidget(
                _('Vertical Position'),
                _('Adjusts vertical position of the new thumbnail as a percentage of the screen height from the top'),
                itemFactory.newScale(verticalPositionAdjustment),
                'verticalPosition',
                null,
                'positionCustom'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Geometry')
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Remember Geometry'),
                _('Enable this option to remember the geometry, restoring the size and position when creating a thumbnail with the same source window as a previously removed one'),
                itemFactory.newSwitch(),
                'rememberGeometry'
            )
        );

        return optionList;
    }

    _getContentOptionList(itemFactory) {
        const optionList = [];

        optionList.push(
            itemFactory.getRowWidget(
                _('Buttons')
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Show Close/Unminimize Button'),
                _('Show the Close/Unminimize Button, which allows you to remove the window thumbnail'),
                itemFactory.newSwitch(),
                'showCloseButton'
            )
        );

        return optionList;
    }

    _getMouseOptionList(itemFactory) {
        const optionList = [];

        optionList.push(
            itemFactory.getRowWidget(
                _('Controls')
            )
        );

        const btnActionList = [
            [_('Disable'), 0],
            [_('Activate Source Window'), 1],
            [_('Activate Source On Current Workspace'), 2],
            [_('Remove Thumbnail'), 3],
            [_('Close Source Window'), 4],
            [_('Toggle Window Preview'), 5],
            [_('Toggle Hide On Hover'), 6],
            [_('Reset Thumbnail Scale'), 7],
            [_('Open WT Preferences'), 8],
        ];

        const scrollActionList = [
            [_('Disable'), 0],
            [_('Resize'), 1],
            [_('Switch Source Window'), 2],
            [_('Change Opacity'), 3],
        ];

        optionList.push(
            itemFactory.getRowWidget(
                _('Double Click Action'),
                null,
                itemFactory.newDropDown(),
                'doubleClickAction',
                btnActionList
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Middle Button Action'),
                null,
                itemFactory.newDropDown(),
                'midBtnAction',
                btnActionList
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Secondary Button Action'),
                null,
                itemFactory.newDropDown(),
                'secBtnAction',
                btnActionList
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Ctrl + Primary Button Action'),
                null,
                itemFactory.newDropDown(),
                'ctrlPrimBtnAction',
                btnActionList
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Ctrl + Secondary Button Action'),
                null,
                itemFactory.newDropDown(),
                'ctrlSecBtnAction',
                btnActionList
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Scroll Wheel Action'),
                null,
                itemFactory.newDropDown(),
                'scrollAction',
                scrollActionList
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Ctrl + Scroll Wheel Action'),
                null,
                itemFactory.newDropDown(),
                'ctrlScrollAction',
                scrollActionList
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Shift + Scroll Wheel Action'),
                null,
                itemFactory.newDropDown(),
                'shiftScrollAction',
                scrollActionList
            )
        );

        return optionList;
    }

    _getKeybindingsOptionList(itemFactory) {
        const optionList = [];

        optionList.push(
            itemFactory.getRowWidget(
                _('Keyboard Shortcuts')
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Create Window Thumbnail'),
                _('Creates a new live thumbnail of the currently focused window'),
                itemFactory.newShortcutButton(),
                'createTmbShortcut'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Minimize To Thumbnail'),
                _('Minimizes the currently focused window to the newly created live thumbnail'),
                itemFactory.newShortcutButton(),
                'minimizeToTmbShortcut'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Remove Last Thumbnail'),
                _('Removes the last-created window thumbnail'),
                itemFactory.newShortcutButton(),
                'removeLastShortcut'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Remove All Thumbnails'),
                _('Removes all window thumbnails'),
                itemFactory.newShortcutButton(),
                'removeAllShortcut'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Toggle Thumbnails Visibility'),
                _('Temporarily hides all created thumbnails'),
                itemFactory.newShortcutButton(),
                'toggleVisibilityShortcut'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Switch Source Window To Next'),
                _('Replaces the source window of a thumbnail. This action applies to the last thumbnail that was not created as "Minimize To Thumbnail"'),
                itemFactory.newShortcutButton(),
                'switchSourceNextShortcut'
            )
        );

        optionList.push(
            itemFactory.getRowWidget(
                _('Switch Source Window To Previous'),
                _('Replaces the source window of a thumbnail. This action applies to the last thumbnail that was not created as "Minimize To Thumbnail"'),
                itemFactory.newShortcutButton(),
                'switchSourcePrevShortcut'
            )
        );

        return optionList;
    }

    _getAboutOptionList(itemFactory) {
        const optionList = [];

        optionList.push(itemFactory.getRowWidget(
            this.Me.metadata.name
        ));

        const versionName = this.Me.metadata['version-name'] ?? '';
        let version = this.Me.metadata['version'] ?? '';
        version = versionName && version ? `/${version}` : version;
        const versionStr = `${versionName}${version}`;
        optionList.push(itemFactory.getRowWidget(
            _('Version'),
            null,
            itemFactory.newLabel(versionStr)
        ));

        optionList.push(itemFactory.getRowWidget(
            _('Reset all options'),
            _('Reset all options to their default values'),
            itemFactory.newOptionsResetButton()
        ));


        optionList.push(itemFactory.getRowWidget(
            _('Links')
        ));

        optionList.push(itemFactory.getRowWidget(
            _('Homepage'),
            _('Source code and more info about this extension'),
            itemFactory.newLinkButton('https://github.com/G-dH/window-thumbnails')
        ));

        /* optionList.push(itemFactory.getRowWidget(
            _('Changelog'),
            _("See what's changed."),
            itemFactory.newLinkButton('https://github.com/G-dH/windows-search-provider/blob/main/CHANGELOG.md')
        ));*/

        optionList.push(itemFactory.getRowWidget(
            _('GNOME Extensions'),
            _('Rate and comment this extension on the GNOME Extensions site'),
            itemFactory.newLinkButton('https://extensions.gnome.org/extension/6816/')
        ));

        optionList.push(itemFactory.getRowWidget(
            _('Report a bug or suggest new feature'),
            _('Help me to help you!'),
            itemFactory.newLinkButton('https://github.com/G-dH/window-thumbnails/issues')
        ));

        optionList.push(itemFactory.getRowWidget(
            _('Buy Me a Coffee'),
            _('Enjoying this extension? Consider supporting it by buying me a coffee!'),
            itemFactory.newLinkButton('https://buymeacoffee.com/georgdh')
        ));

        return optionList;
    }
}
