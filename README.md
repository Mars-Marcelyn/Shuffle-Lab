# Shuffle Lab

Timed, randomized fullscreen image slideshows for drawing practice, presentations, and more.

## Features

- Fullscreen slideshow with randomized images from any vault folder
- Configurable duration per image with presets (30s, 60s, 2min, 5min, custom)
- Loop toggle — choose whether to repeat images or stop when they run out
- Session timer with real-time display
- Intro prompt slide (optional markdown file per folder)
- Session logging to prioritize unseen images next session
- Language support (desktop only)

## Usage

1. Open **Settings → Shuffle Lab** and set your **Main directory** (the root folder containing your reference image subfolders).
2. Click the shuffle icon in the ribbon or run the **New session** command.
3. Select a folder, adjust settings, and click **Start Session**.
4. Press **Space** to pause/resume, **◀/▶** to navigate, **ESC** to exit.

## Installation

### From Community Plugins (desktop)
Search for "Shuffle Lab" in Community Plugins and install.

### Manual / mobile
Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/shuffle-lab/` in your vault.

## Localization (desktop only)

1. Open **Settings → Shuffle Lab** and click **Open folder** next to "Language files".
2. Copy `en.json` from the `lang/` folder, rename it to your language code (e.g. `de.json`).
3. Translate all values (the text after the colons). Keep keys, `{0}` placeholders, and `\n` unchanged.
4. Reload Obsidian, then select your language in **Settings → Shuffle Lab**.

The language dropdown only shows `.json` files present in the `lang/` folder. On mobile, the plugin uses English only.

## License

MIT