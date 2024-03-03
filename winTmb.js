/**
 * WTMB (Window Thumbnails)
 * WinTmb
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2024
 * @license    GPL-3.0
 */

'use strict';

const { Clutter, GLib, GObject, Meta, St, Graphene } = imports.gi;

const Main = imports.ui.main;
const DND = imports.ui.dnd;

let Me;
let opt;
let _;

// const SCROLL_ICON_OPACITY = 240;
const DRAG_OPACITY = 200;
const CLOSE_BTN_OPACITY = 240;
const ANIMATION_TIME = 400; // windowManager.MINIMIZE_WINDOW_ANIMATION_TIME


var WinTmbModule = class {
    constructor(me) {
        Me = me;
        opt = Me.opt;
        _ = Me._;

        this._firstActivation = true;
        this.moduleEnabled = false;
    }

    cleanGlobals() {
        Me = null;
        opt = null;
        _ = null;
    }

    update(reset) {
        this._removeTimeouts();

        if (reset)
            this._disableModule();
        else
            this._activateModule();
    }

    _activateModule() {
        this._timeouts = {};
        if (!this._windowThumbnails)
            this._windowThumbnails = [];

        Main.overview.connectObject('hiding', () => {
            if (!this._thumbnailsHiddenByUser)
                this.showAll();
        }, this);
        Main.overview.connectObject('showing', () => this.hideAll(), this);

        // Create a globally accessible API for other extensions
        global.windowThumbnails = {
            createThumbnail: this.createThumbnail.bind(this),
            minimizeToThumbnail: this.minimizeToThumbnail.bind(this),
            hideAll: this.hideAll.bind(this),
            showAll: this.showAll.bind(this),
            toggleShowAll: this.toggleShowAll.bind(this),
            removeAll: this.removeAll.bind(this),
            removeLast: this.removeLast.bind(this),
            switchSourceNext: this.switchSourceNext.bind(this),
            switchSourcePrev: this.switchSourcePrev.bind(this),
            getThumbnails: () => this._windowThumbnails,
        };

        console.debug('  WinTmb - Activated');
    }

    _disableModule() {
        Main.overview.disconnectObject(this);
        this.removeAll();
        global.windowThumbnails = null;

        console.debug('  WinTmb - Disabled');
    }

    _removeTimeouts() {
        if (this._timeouts) {
            Object.values(this._timeouts).forEach(t => {
                if (t)
                    GLib.source_remove(t);
            });
            this._timeouts = null;
        }
    }

    createThumbnail(metaWin, minimize = false) {
        metaWin = metaWin || this._getCurrentWindow();
        if (!metaWin) {
            console.error(`[${Me.metadata.name}] createThumbnail: Missing argument of type Meta.Window`);
            return null;
        }

        if (minimize && !metaWin.can_minimize()) {
            Main.notify(_('This window cannot be minimized'), metaWin.title);
            return null;
        }

        // In the single tmb mode, set the new thumbnail icon geometry to the position of the last one
        // so the user
        if (!minimize && opt.LIMIT_TO_ONE) {
            this._removeAllNotMinimizedThumbnails();
            if (this._lastTmbGeometry)
                metaWin._thumbnailGeometry = this._lastTmbGeometry;
        }

        const monitor = Main.layoutManager.monitors[metaWin.get_monitor()];

        // Calculate an offset to minimize thumbnails overlapping
        let yOffset = monitor.height;
        for (let i = this._windowThumbnails.length - 1; i > -1; i--) {
            const tmb = this._windowThumbnails[i];
            // Only one thumbnail of each window is allowed
            if (tmb._metaWin === metaWin)
                tmb.remove();
            else
            if (tmb._monitor === monitor && tmb.y < yOffset)
                yOffset = tmb.y;
        }

        yOffset = monitor.height - yOffset;

        const thumbnail = new WindowThumbnail(metaWin, {
            yOffset,
            minimize,
        });

        this._windowThumbnails.push(thumbnail);
        thumbnail.connect('remove', tmb => {
            this._windowThumbnails.splice(this._windowThumbnails.indexOf(tmb), 1);
            tmb.destroy();
        });

        return thumbnail;
    }

    _getCurrentWindow() {
        const metaWin = global.display.get_tab_list(0, null)[0];
        if (!metaWin)
            return null;

        return metaWin.get_workspace() === global.workspaceManager.get_active_workspace()
            ? metaWin
            : null;
    }

    minimizeToThumbnail(metaWin) {
        const minimize = true;
        return this.createThumbnail(metaWin, minimize);
    }

    hideAll() {
        this._windowThumbnails.forEach(tmb => {
            tmb.ease({
                opacity: 0,
                duration: 200,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => tmb.hide(),
            });
        });
        this._thumbnailsHidden = true;
    }

    showAll() {
        this._windowThumbnails.forEach(tmb => {
            tmb.show();
            tmb.ease({
                opacity: 255,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        });
        this._thumbnailsHidden = false;
    }

    toggleShowAll() {
        if (this._thumbnailsHidden) {
            this.showAll();
            this._thumbnailsHiddenByUser = false;
        } else {
            this.hideAll();
            this._thumbnailsHiddenByUser = true;
        }
    }

    removeAll() {
        for (let i = this._windowThumbnails.length - 1; i > -1; i--)
            this._windowThumbnails[i].remove();
        this._windowThumbnails = [];
    }

    _removeAllNotMinimizedThumbnails() {
        let lastTmbGeometry;
        for (let i = this._windowThumbnails.length - 1; i > -1; i--) {
            const tmb = this._windowThumbnails[i];
            if (!tmb._minimized) {
                if (!lastTmbGeometry)
                    lastTmbGeometry = tmb._metaWin._thumbnailGeometry;
                tmb.remove();
            }
        }
        this._lastTmbGeometry = opt.LIMIT_TO_ONE && lastTmbGeometry
            ? lastTmbGeometry
            : null;
    }

    removeLast() {
        if (!this._windowThumbnails)
            return;

        for (let i = this._windowThumbnails.length - 1; i > -1; i--) {
            const tmb = this._windowThumbnails[i];
            if (tmb.visible) {
                tmb.remove();
                break;
            }
        }
    }

    _getLastNotMinimizedTmb() {
        for (let i = this._windowThumbnails.length - 1; i > -1; i--) {
            const tmb = this._windowThumbnails[i];
            if (!tmb._minimized)
                return tmb;
        }
        return null;
    }

    switchSourceNext() {
        const tmb = this._getLastNotMinimizedTmb();
        if (!tmb)
            return;

        tmb._switchSourceWin(Clutter.ScrollDirection.DOWN);
    }

    switchSourcePrev() {
        const tmb = this._getLastNotMinimizedTmb();
        if (!tmb)
            return;

        tmb._switchSourceWin(Clutter.ScrollDirection.UP);
    }
};

const WindowThumbnail = GObject.registerClass({
    Signals: { 'remove': {} },
}, class WindowThumbnail extends St.Widget {
    _init(metaWin, params) {
        super._init({
            layout_manager: new Clutter.BinLayout(),
            visible: true,
            reactive: true,
            can_focus: true,
            track_hover: true,
        });

        // this._metaWin
        // this._windowActor
        // this._winGeometry
        this._updateMetaWinSources(metaWin);

        this._minimized = params.minimize;
        this._customOpacity = opt.DEFAULT_OPACITY;

        this._scrollTime = 0;
        this._prevBtnPressTime = 0;
        this._yOffset = params.yOffset;

        this._click_count = 1;

        // Implement DND functionality
        this._delegate = this;
        this._draggable = DND.makeDraggable(this, { dragActorOpacity: DRAG_OPACITY });
        this._draggable.connect('drag-end', this._endDrag.bind(this));
        this._draggable.connect('drag-cancelled', this._endDrag.bind(this));
        this._draggable._animateDragEnd = eventTime => {
            this._draggable._animationInProgress = true;
            this._draggable._onAnimationComplete(this._draggable._dragActor, eventTime);
            this.opacity = 255;
        };

        // Insert window clone
        this._clone = new Clutter.Clone({
            reactive: false,
            opacity: this._customOpacity,
            pivot_point: new Graphene.Point({ x: 0.5, y: 0.5 }),
        });
        this._clone.set_source(this._windowActor);
        this.add_child(this._clone);

        // "Remove" shadow box
        this._updateCloneScale();

        this._addControls();

        Main.layoutManager.addChrome(this);

        // HOVER_SHOW_PREVIEW can be toggled by the user anytime
        // which has to be also able to toggle HOVER_HIDE_TMB
        this.HOVER_SHOW_PREVIEW = opt.HOVER_SHOW_PREVIEW;
        this.HOVER_HIDE_TMB = opt.HOVER_HIDE_TMB;

        // Restore and adapt the previous thumbnail position and size if a thumbnail of the window existed during the current session
        if (opt.REMEMBER_GEOMETRY && metaWin._thumbnailGeometry) {
            this._geometry = metaWin._thumbnailGeometry;
            this._fixGeometry(false);

            // Set position now only if the thumbnail don't need to be animated
            if (this._minimized)
                this._applyGeometryPosition();
        } else {
            this._createTmbGeometry();
        }

        if (this._minimized) {
            this._applyGeometry();

            this.opacity = 0;
            // Set the window target geometry to the size of this
            this._updateWindowIconGeometry();
            // icon geometry is a target rectangle for the minimize animation
            // store the default and restore it in this.remove
            [, this._origIconGeometry] = metaWin.get_icon_geometry();
            // Set delay for the minimize animation and then show the thumbnail
            this._setMinimizedAnimationDelay();
            metaWin.minimize();
        } else {
            this._animateNewTmb();
        }

        this.connect('button-release-event', this._onBtnReleased.bind(this));
        this.connect('scroll-event', this._onScrollEvent.bind(this));
        // this.connect('motion-event', this._onMouseMove.bind(this)); // may be useful in the future..
        this.connect('enter-event', this._onEnterEvent.bind(this));
        this.connect('leave-event', this._onLeaveEvent.bind(this));
        this._updateSourceConnections();
        Main.layoutManager.connectObject('monitors-changed', () => this._onMonitorsChanged(), this);

        this.tmbRedrawDirection = true;
    }

    _updateMetaWinSources(metaWin) {
        this._metaWin = metaWin;
        this._winGeometry = metaWin.get_frame_rect();
        this._windowActor = metaWin.get_compositor_private();
        this._monitor = Main.layoutManager.monitors[metaWin.get_monitor()];
    }

    _updateSourceConnections(disconnect = false) {
        this._windowActor.disconnectObject(this);
        this._metaWin.disconnectObject(this);

        if (disconnect)
            return;

        // remove thumbnail content and hide thumbnail if its window is destroyed
        this._windowActor.connectObject('destroy', () => {
            this.remove();
        }, this);

        if (this._minimized) {
            // if window has been unminimized, remove thumbnail
            this._metaWin.connectObject('shown', () => {
                this.remove();
            }, this);
        }
    }

    _createTmbGeometry() {
        this._geometry = new Meta.Rectangle();
        this._geometry.monitorIndex = this._monitor.index;
        this._geometry.scale = this._getDefaultScale();

        // size needs this._geometry.scale set
        const [width, height] = this._getPreferredSize();
        this._geometry.width = width;
        this._geometry.height = height;
        // position needs this._geometry.size set
        const [x, y] = this._getInitialPosition();
        this._geometry.x = x;
        this._geometry.y = y;
    }

    _getDefaultScale() {
        // Use dimensions of the source window without shadow
        const { width, height } = this._metaWin.get_frame_rect();
        const maxScale = Math.min(this._monitor.width / width, this._monitor.height / height);

        let scale;
        if (opt.SCALE_AXIS_VERTICAL)
            scale = (opt.DEFAULT_SCALE * this._monitor.height) / height;
        else
            scale = (opt.DEFAULT_SCALE * this._monitor.width) / width;

        return Math.min(scale, maxScale);
    }

    _applyGeometryPosition() {
        this.set_position(this._geometry.x, this._geometry.y);
    }

    _applyGeometrySize() {
        const [width, height] = this._getPreferredSize();
        this._geometry.width = width;
        this._geometry.height = height;
        this.set_size(width, height);
        // when the scale of this. actor change, this._clone resize accordingly,
        // but the reactive area of the actor doesn't change until the actor is redrawn
        // this updates the actor's input region area
        Main.layoutManager._queueUpdateRegions();
    }

    _applyGeometry() {
        this._applyGeometrySize();
        this._applyGeometryPosition();
    }

    _getPreferredSize() {
        const width = Math.round(this._winGeometry.width * this._geometry.scale);
        const height = Math.round(this._winGeometry.height * this._geometry.scale);
        return [width, height];
    }

    _getInitialPosition() {
        let x, y;
        const { width, height } = this._geometry;
        if (opt.POSITION_CUSTOM) {
            const monitor = this._monitor;
            x = monitor.x + monitor.width * opt.H_POSITION - width;
            y = monitor.y + monitor.height * opt.V_POSITION - height;
            let xMax = (monitor.x + monitor.width) - width;
            let yMax = (monitor.y + monitor.height) - height;
            let yOffset = this._yOffset % (monitor.height - height);
            y -= yOffset;
            x = Math.round(Math.min(x, xMax));
            y = Math.round(Math.min(y, yMax));
        } else {
            [x, y] = global.get_pointer();
            x += 5;
            y += 5;
        }
        return [x, y];
    }

    _updateCloneScale() {
        // Scale up the clone to move the shadow box out of the parent widget
        // The clone is not reactive to mouse events, so it's like it's cropped
        // windowActor.size includes shadow box,
        // we need to get the original window size to calculate the scale
        const shadowSizeH = this._windowActor.width - this._winGeometry.width;
        const shadowSizeV = this._windowActor.height - this._winGeometry.height;
        const shadowSize = Math.max(shadowSizeH, shadowSizeV);
        const cloneScale = 1 + shadowSize / this._windowActor.width;
        this.shadowSize = shadowSize;
        this._clone.scale_x = cloneScale;
        this._clone.scale_y = cloneScale;
    }

    _fixGeometry(apply = true) {
        const tmbGeo = this._geometry;
        this._monitor = Main.layoutManager.monitors[tmbGeo.monitorIndex] || this._monitor;
        let { width, height } = tmbGeo;

        if (opt.SCALE_AXIS_VERTICAL)
            width = (this._winGeometry.width / this._winGeometry.height) * height;
        else
            height = (this._winGeometry.height / this._winGeometry.width) * width;

        tmbGeo.width = width;
        tmbGeo.height = height;

        tmbGeo.scale = width / this._winGeometry.width;

        this._fixGeometryPosition(apply);

        if (apply)
            this._applyGeometry();
    }

    _fixGeometryPosition(apply = true) {
        const tmbGeo = this._geometry;
        // Ensure the entire thumbnail will be visible on screen
        let { x, y } = tmbGeo;
        const { width, height } = tmbGeo;
        const monitor = this._monitor;
        x = Math.clamp(monitor.x, x, (monitor.x + monitor.width) - width);
        y = Math.clamp(monitor.y, y, (monitor.y + monitor.height) - height);

        [tmbGeo.x, tmbGeo.y] = [x, y];

        if (apply)
            this._applyGeometryPosition();
    }

    _resetScale() {
        this._geometry.scale = this._getDefaultScale();
        const [width, height] = this._getPreferredSize();
        this._geometry.width = width;
        this._geometry.height = height;
        this._fixGeometryPosition();
        this._applyGeometrySize();
    }

    // set an area to/from which the window should animate minimize/unminimize
    _updateWindowIconGeometry() {
        // Compensate for shadow box
        const scale = this._clone.scale_x;
        const offsetX = (this.width * scale - this.width) / 2;
        const offsetY = (this.height * scale - this.height) / 2;
        const tmbGeo = this._geometry;
        const iconGeometry = new Meta.Rectangle({
            // compensate for window's shadow box
            x: Math.round(tmbGeo.x - offsetX),
            y: Math.round(tmbGeo.y - offsetY),
            width: Math.round(tmbGeo.width * scale),
            height: Math.round(tmbGeo.height * scale),
        });
        // icon geometry is a target rectangle for the minimize and starting for unminimize animations
        this._metaWin.set_icon_geometry(iconGeometry);
    }

    _getCurrentTmbMonitor() {
        const monitors = Main.layoutManager.monitors;
        let monitor = null;

        /* const [x, y] = this.get_position();
        const [width, height] = this.get_size();*/
        const monitorIndex = global.display.get_monitor_index_for_rect(this._geometry);
        monitor = monitors[monitorIndex];

        /* monitors.forEach(mon => {
            if (x >= mon.x && y >= mon.y && x < mon.x + mon.width && y < mon.y + mon.height)
                monitor = mon;
        });*/
        return monitor;
    }

    _endDrag() {
        this._geometry.x = Math.round(this._draggable._dragOffsetX + this._draggable._dragX);
        this._geometry.y = Math.round(this._draggable._dragOffsetY + this._draggable._dragY);
        const monitor = this._getCurrentTmbMonitor();
        this._monitor = monitor;
        this._geometry.monitorIndex = monitor.index;
        // The thumbnail should stay on screen
        this._fixGeometryPosition();
        this._applyGeometry();
        this._geometry.monitorIndex = monitor.index;
    }

    // Animate new thumbnail from the source window to the thumbnail position
    _animateNewTmb() {
        if (!this._geometry)
            this._createTmbGeometry();

        const tmbGeo = this._geometry;

        const { width, height } = tmbGeo;
        const { x, y } = tmbGeo;

        this.x = this._winGeometry.x;
        this.y = this._winGeometry.y;

        this.ease({
            x, y,
            width, height,
            duration: opt.ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_EXPO,
        });
    }

    _setMinimizedAnimationDelay(minimize = true) {
        // We can't change the default minimize/maximize animation time
        // As a workaround
        // we temporarily adjust the global animation speed and restore it after the animation completes
        const ANIMATION_TIME = 400; // windowManager.MINIMIZE_WINDOW_ANIMATION_TIME = 400
        let delay = ANIMATION_TIME;
        const stSettings = St.Settings.get();
        const globWT = global.windowThumbnails;

        if (!globWT._originalSlowDownFactor && (opt.ANIMATION_TIME !== ANIMATION_TIME)) {
            const currentSlowdownFactor = stSettings.slow_down_factor;
            // Make the process globally visible to avoid conflicts between thumbnails
            globWT._originalSlowDownFactor = currentSlowdownFactor;
            const factorScale = opt.ANIMATION_TIME / ANIMATION_TIME;
            // slow_down_factor cannot be too small
            stSettings.slow_down_factor = Math.max(0.01, currentSlowdownFactor * factorScale);
            // synchronize delay with the current animation speed
            delay = factorScale * ANIMATION_TIME;
            if (!globWT._wtQueue)
                globWT._wtQueue = [];
            globWT._wtQueue.push(true);
        } else if (globWT._originalSlowDownFactor) {
            delay = stSettings.slow_down_factor * ANIMATION_TIME;
            globWT._wtQueue.push(true);
        }

        this._minimizeDelayId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            delay,
            () => {
                if (globWT._originalSlowDownFactor) {
                    globWT._wtQueue.pop();
                    if (!globWT._wtQueue.length) {
                        stSettings.slow_down_factor = globWT._originalSlowDownFactor;
                        delete globWT._wtQueue;
                        delete globWT._originalSlowDownFactor;
                    }
                }
                if (minimize)
                    this.opacity = 255;
                else
                    this.emit('remove');
                this._minimizeDelayId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _onEnterEvent() {
        if (!this._getHover() || this._showTimeoutId || this._tmbDestroyed)
            return;

        global.display.set_cursor(Meta.Cursor.POINTING_HAND);
        this._closeButton.opacity = CLOSE_BTN_OPACITY;

        if (!(this.HOVER_SHOW_PREVIEW  || this.HOVER_HIDE_TMB) || Me.Util.isAltPressed())
            return;

        if (this._hoverActionDelayId)
            GLib.source_remove(this._hoverActionDelayId);

        this._hoverActionDelayId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            opt.HOVER_DELAY,
            () => {
                if (this.HOVER_SHOW_PREVIEW && !this._winPreview && !Main.overview._shown) {
                    this._showWindowPreview(false, true);
                } else if (this.HOVER_HIDE_TMB) {
                    // store allocation so we can access it even if the widget is hidden
                    this._lastAllocation = {};
                    this._lastAllocation.x1 = this.allocation.x1;
                    this._lastAllocation.x2 = this.allocation.x2;
                    this._lastAllocation.y1 = this.allocation.y1;
                    this._lastAllocation.y2 = this.allocation.y2;
                    this.hide();
                    this._showTimeoutId = GLib.timeout_add(
                        GLib.PRIORITY_DEFAULT,
                        500,
                        () => {
                            if (this._getHover(this._lastAllocation)) {
                                return GLib.SOURCE_CONTINUE;
                            } else {
                                this.show();
                                this._showTimeoutId = 0;
                                return GLib.SOURCE_REMOVE;
                            }
                        }
                    );
                }

                this._hoverActionDelayId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _onLeaveEvent() {
        if (this._getHover(true))
            return;

        if (this._tmbDestroyed)
            return;

        if (this._hoverActionDelayId) {
            GLib.source_remove(this._hoverActionDelayId);
            this._hoverActionDelayId = 0;
        }

        global.display.set_cursor(Meta.Cursor.DEFAULT);
        this._closeButton.opacity = 0;

        if (this._winPreview)
            this._destroyWindowPreview();
    }

    /* _onMouseMove(actor, event) {
        let [pos_x, pos_y] = event.get_coords();
        let state = event.get_state();
        if (Me.Util.isCtrlPressed(state)) {
        }
    }*/

    _getHover(allocation, leave = false) {
        if (!allocation)
            allocation = this.allocation;

        // add/remove 5px according to the pointer direction to improve reliability of the detection
        const margin = leave ? -5 : 5;
        const [x, y] = global.get_pointer();
        const { x1, x2, y1, y2 } = allocation;
        return (x >= x1 - margin) && (x <= x2 + margin) && (y >= y1 - margin) && (y <= y2 + margin);
    }

    _onBtnReleased(actor, event) {
        // Clutter.Event.click_count property in no longer available, since GS42
        if ((event.get_time() - this._prevBtnPressTime) < Clutter.Settings.get_default().double_click_time)
            this._click_count += 1;
        else
            this._click_count = 1;

        this._prevBtnPressTime = event.get_time();

        let action;
        if (this._click_count === 2 && event.get_button() === Clutter.BUTTON_PRIMARY) {
            action = opt.get('doubleClickAction');
            this._triggerBtnAction(action);
            return Clutter.EVENT_STOP;
        }

        const button = event.get_button();
        const state = event.get_state();

        if (button === Clutter.BUTTON_PRIMARY) {
            if (Me.Util.isCtrlPressed(state))
                action = opt.get('ctrlPrimBtnAction');
        } else if (button === Clutter.BUTTON_MIDDLE) {
            action = opt.get('midBtnAction');
        } else if (button === Clutter.BUTTON_SECONDARY) {
            if (Me.Util.isCtrlPressed(state))
                action = opt.get('ctrlSecBtnAction');
            else
                action = opt.get('secBtnAction');
        }

        this._triggerBtnAction(action);

        return Clutter.EVENT_STOP;
    }

    _onScrollEvent(actor, event) {
        if ((Date.now() - this._scrollTime) < 50)
            return Clutter.EVENT_STOP;

        this._scrollTime = Date.now();
        let direction = Me.Util.getScrollDirection(event);
        let state = event.get_state();

        let action;
        if (Me.Util.isCtrlPressed(state))
            action = opt.get('ctrlScrollAction');
        else if (Me.Util.isShiftPressed(state))
            action = opt.get('shiftScrollAction');
        else
            action = opt.get('scrollAction');

        this._triggerScrollAction(action, direction);

        return Clutter.EVENT_STOP;
    }

    _switchSourceWin(direction) {
        // Thumbnails from minimized windows cannot switch source
        if (this._minimized)
            return;

        direction = direction === Clutter.ScrollDirection.UP
            ? -1
            : 1;

        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        windows = windows.filter(w => !(w.skip_taskbar || w.minimized));
        let idx = -1;
        for (let i = 0; i < windows.length; i++) {
            if (windows[i] === this._metaWin) {
                idx = i + direction;
                break;
            }
        }

        idx = idx >= windows.length ? 0 : idx;
        idx = idx < 0 ? windows.length - 1 : idx;

        let metaWin = windows[idx];

        if (metaWin === this._metaWin)
            return;

        const disconnect = true;
        this._updateSourceConnections(disconnect);

        this._updateMetaWinSources(metaWin);
        this._clone.set_source(this._windowActor);

        this._fixGeometry();
        this._updateCloneScale();

        this._updateSourceConnections();

        if (this._winPreview) {
            const update = true;
            this._showWindowPreview(update);
        }
    }

    _resize(direction) {
        switch (direction) {
        case Clutter.ScrollDirection.UP:
            this._geometry.scale = Math.max(0.05, this._geometry.scale - 0.025);
            break;
        case Clutter.ScrollDirection.DOWN:
            this._geometry.scale = Math.min(1, this._geometry.scale + 0.025);
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        this._applyGeometrySize();
        this._fixGeometryPosition();

        return Clutter.EVENT_STOP;
    }

    _changeOpacity(direction) {
        switch (direction) {
        case Clutter.ScrollDirection.UP:
            this._clone.opacity = Math.min(255, this._clone.opacity - 24);
            this._customOpacity = this._clone.opacity;
            break;
        case Clutter.ScrollDirection.DOWN:
            this._clone.opacity = Math.max(48, this._clone.opacity + 24);
            this._customOpacity = this._clone.opacity;
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        this._applyGeometrySize();
        this._fixGeometryPosition();

        return Clutter.EVENT_STOP;
    }

    _onMonitorsChanged() {
        // Thumbnail may stay out of the screen after changing configuration
        this._fixGeometryPosition();
    }

    remove() {
        this._tmbDestroyed = true;

        this.remove_all_transitions();

        const disconnect = true;
        this._updateSourceConnections(disconnect);

        Main.layoutManager.disconnectObject(this);

        if (this._winPreview)
            this._destroyWindowPreview();

        if (this._minimized) {
            // Update the window icon geometry so the unminimize animation have a proper staring position and size
            this._updateWindowIconGeometry();
            // Hide the thumbnail so it will be invisible during assisted unminimize animation
            this.hide();
            // If animation speed is not default, assistance is needed
            // Set timeout for the unminimize animation and emit 'remove' signal after the animation
            if (opt.ANIMATION_TIME !== 400) // 400 is default
                this._setMinimizedAnimationDelay(false);
            this._activateWinOnCurrentWs();
            // Restore the original icon geometry so it will animate normal minimize to the proper target
            this._metaWin.set_icon_geometry(this._origIconGeometry);
            if (opt.ANIMATION_TIME === 400) {
                if (this._minimizeDelayId) {
                    GLib.source_remove(this._minimizeDelayId);
                    this._minimizeDelayId = 0;
                }
                this.emit('remove');
            }
        } else {
            this.emit('remove');
        }

        this._metaWin._thumbnailGeometry = this._geometry;
    }

    _actionTimeoutActive() {
        const timeout = this._reverseTmbWheelFunc ? this._scrollTimeout : this._scrollTimeout / 4;
        if (!this._lastActionTime || Date.now() - this._lastActionTime > timeout) {
            this._lastActionTime = Date.now();
            return false;
        }
        return true;
    }

    _addControls() {
        if (opt.SHOW_CLOSE_BUTTON)
            this._addCloseButton();
    }

    _addCloseButton() {
        const closeButton = new St.Button({
            opacity: 0,
            style_class: 'window-close',
            child: new St.Icon({ icon_name: 'preview-close-symbolic' }),
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START,
            x_expand: true,
            y_expand: true,
        });

        if (this._minimized) {
            closeButton.set_child(new St.Icon({
                icon_name: 'window-restore-symbolic',
                icon_size: 32,
            }));
        }

        closeButton.translation_x = -8;
        closeButton.translation_y = 8;

        closeButton.connect('clicked', () => {
            this.remove();
            return Clutter.EVENT_STOP;
        });

        this._closeButton = closeButton;
        this.add_child(this._closeButton);
    }

    _addMediaControl() {

    }

    _showWindowPreview(update = false, dontDestroy = false) {
        if (this._winPreview && !dontDestroy) {
            this._destroyWindowPreview();
            this._closeButton.opacity = CLOSE_BTN_OPACITY;
            if (!update)
                return;
        }

        if (!this._winPreview) {
            this._winPreview = new WindowPreview();
            Main.layoutManager.addChrome(this._winPreview);
            Main.layoutManager.uiGroup.set_child_above_sibling(this._winPreview, null);
            [this._winPreview._xPointer, this._winPreview._yPointer] = global.get_pointer();
        }

        if (!update) {
            this._winPreview.opacity = 255;
            this._winPreview.ease({
                opacity: 255,
                duration: 70,
                mode: Clutter.AnimationMode.LINEAR,
            });
        } else {
            this._winPreview.opacity = 255;
        }
        this._winPreview.window = this._metaWin;
    }

    _destroyWindowPreview() {
        if (this._winPreview) {
            if (this._tmbDestroyed) {
                this._winPreview.destroy();
                this._winPreview = null;
                return;
            }
            this._winPreview.ease({
                opacity: 0,
                duration: 100,
                mode: Clutter.AnimationMode.LINEAR,
                onComplete: () => {
                    this._winPreview.destroy();
                    this._winPreview = null;
                },
            });
        }
    }

    _activateWindow() {
        if (this._minimized)
            this.remove();
        else
            this._metaWin.activate(global.get_current_time());
    }

    _activateWinOnCurrentWs() {
        this._metaWin.change_workspace(global.workspaceManager.get_active_workspace());
        this._metaWin.activate(global.get_current_time());
    }

    _toggleHoverWinPreview() {
        this.HOVER_SHOW_PREVIEW = !this.HOVER_SHOW_PREVIEW;
        this.HOVER_HIDE_TMB = false;
        this._showWindowPreview();
    }

    _toggleHoverHide() {
        this.HOVER_HIDE_TMB = !this.HOVER_HIDE_TMB;
        this.HOVER_SHOW_PREVIEW = false;
        this._destroyWindowPreview();
    }

    _triggerBtnAction(action) {
        /* [_('Disable'), 0],
           [_('Activate Window'), 1],
           [_('Activate Window On Current Workspace'), 2],
           [_('Remove Thumbnail'), 3],
           [_('Close Source Window'), 4],
           [_('Toggle Window Preview'), 5],
           [_('Toggle Hide On Hover'), 6],
           [_('Reset Thumbnail Scale'), 7],
           [_('Open WT Preferences'), 8],
        */

        switch (action) {
        case 1:
            this._activateWindow();
            break;
        case 2:
            if (this._minimized)
                this._remove();
            else
                this._activateWinOnCurrentWs();
            break;
        case 3:
            this.remove();
            break;
        case 4:
            this._metaWin.delete(global.get_current_time());
            break;
        case 5:
            this._toggleHoverWinPreview();
            break;
        case 6:
            this._toggleHoverHide();
            break;
        case 7:
            this._resetScale();
            break;
        case 8:
            Me.Util.openPreferences();
            break;
        }
    }

    _triggerScrollAction(action, direction) {
        switch (action) {
        case 1:
            this._resize(direction);
            break;
        case 2:
            this._switchSourceWin(direction);
            break;
        case 3:
            this._changeOpacity(direction);
            break;
        }
    }

    /* _setIcon() {
        let tracker = Shell.WindowTracker.get_default();
        let app = tracker.get_window_app(this._metaWin);
        let icon = app
            ? app.create_icon_texture(this.height)
            : new St.Icon({ icon_name: 'icon-missing', icon_size: this.height });
        icon.x_expand = icon.y_expand = true;
        if (this.icon)
            this.icon.destroy();
        this.icon = icon;
    }*/

    /* _addScrollModeIcon() {
        this._scrollModeBin = new St.Bin({
            x_expand: true,
            y_expand: true,
        });
        this._scrollModeResizeIcon = new St.Icon({
            icon_name: 'view-fullscreen-symbolic',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            x_expand: true,
            y_expand: true,
            opacity: SCROLL_ICON_OPACITY,
            style_class: 'icon-dropshadow',
            scale_x: 0.5,
            scale_y: 0.5,
        });
        this._scrollModeResizeIcon.set_style(`
            margin: 13px;
            color: rgb(255, 255, 255);
            box-shadow: 0 0 40px 40px rgba(0,0,0,0.7);
        `);
        this._scrollModeSourceIcon = new St.Icon({
            icon_name: 'media-skip-forward-symbolic',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            x_expand: true,
            y_expand: true,
            opacity: SCROLL_ICON_OPACITY,
            style_class: 'icon-dropshadow',
            scale_x: 0.5,
            scale_y: 0.5,
        });
        this._scrollModeSourceIcon.set_style(`
            margin: 13px;
            color: rgb(255, 255, 255);
            box-shadow: 0 0 40px 40px rgba(0,0,0,0.7);
        `);
        this._scrollModeBin.set_child(this._scrollModeResizeIcon);
        this.add_child(this._scrollModeBin);
        this._scrollModeBin.opacity = 0;
    }*/
});

// Copy of AltTab.CyclerHighlight
const WindowPreview = GObject.registerClass(
class WindowPreview extends St.Widget {
    _init() {
        super._init({ layout_manager: new Clutter.BinLayout() });
        this._metaWin = null;

        this._clone = new Clutter.Clone();
        this.add_child(this._clone);

        this._highlight = new St.Widget({ style_class: 'cycler-highlight' });
        this._highlight.set_style('border: 3px;');
        this.add_child(this._highlight);

        let coordinate = Clutter.BindCoordinate.ALL;
        let constraint = new Clutter.BindConstraint({ coordinate });
        this._clone.bind_property('source', constraint, 'source', 0);

        this.add_constraint(constraint);

        this.connect('destroy', this._onDestroy.bind(this));
    }

    set window(w) {
        if (this._metaWin === w)
            return;

        this._metaWin?.disconnectObject(this);

        this._metaWin = w;

        if (this._clone.source)
            this._clone.source.sync_visibility();

        const windowActor = this._metaWin?.get_compositor_private() ?? null;

        this._clone.source = windowActor;

        if (this._metaWin) {
            this._onSizeChanged();
            this._metaWin.connectObject('size-changed',
                this._onSizeChanged.bind(this), this);
        } else {
            this._highlight.set_size(0, 0);
            this._highlight.hide();
        }
    }

    _onSizeChanged() {
        const bufferRect = this._metaWin.get_buffer_rect();
        const rect = this._metaWin.get_frame_rect();
        this._highlight.set_size(rect.width, rect.height);
        this._highlight.set_position(
            rect.x - bufferRect.x,
            rect.y - bufferRect.y);
        this._highlight.show();
    }

    _onDestroy() {
        this._metaWin = null;
    }
});
