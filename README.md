# WTMB (Window Thumbnails)
A GNOME Shell extension that allows the creation of scaled-down window clones for use as Picture-in-Picture (PIP) thumbnails.

WTMB is supported by the V-Shell, AATWS and CHC-E extensions which allows you to create window thumbnails using their controls.

## Features
- Supports GNOME Shell 42 - 46
- Thumbnails support DND to move them anywhere on the screen
- Minimize windows to thumbnails
- Optional full size preview on hover
- Optional hide on hover
- Custom default scale, position and opacity, animation speed
- Resizable by scrolling
- Fully customizable mouse and keyboard control
- An unlimited number or a single thumbnail
- Windows can remember position nad size of their thumbnail after the thumbnail was removed so the thumbnail can be restored later
- Multi-monitor support
- Custom keyboard shortcuts


[<img alt="" height="100" src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true">](https://extensions.gnome.org/extension/6816/)


## Installation
### Installation from extensions.gnome.org
The easiest way to install WTMB: go to [extensions.gnome.org](https://extensions.gnome.org/extension/6816/) and toggle the switch. This installation also gives you automatic updates in the future.

### Installation from GitHub repository
The latest development version
You may need to install `git`, `make`, `gettext` and `glib2.0` for successful installation.
Navigate to the directory you want to download the source code and execute following commands in the terminal:

#### GNOME 45+

    git clone https://github.com/G-dH/window-thumbnails.git
    cd window-thumbnails
    make install

#### GNOME 42-44

    git clone https://github.com/G-dH/window-thumbnails.git
    cd window-thumbnails
    git checkout gnome-42-44
    make install

### Enabling the extension
After installation you need to enable the extension.

- First restart GNOME Shell (`ALt` + `F2`, `r`, `Enter`, or Log-Out/Log-In if you use Wayland)
- Now you should see the *WTMB (Window Thumbnails)* extension in the *Extensions* application (reopen the app if needed to load new data), where you can enable it.

## Buy me a coffee
If you like my extensions and want to keep me motivated give me some useful feedback, but you can also help me with my coffee expenses:
[buymeacoffee.com/georgdh](https://buymeacoffee.com/georgdh)
