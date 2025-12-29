# AutoStepper

**Generate StepMania/ITGMania charts from audio or YouTube**

Two ways to use AutoStepper:

| Version | Description | Best For |
|---------|-------------|----------|
| **[CLI](#cli-version)** | Python command-line tool | Creating .zip packages for StepMania/ITGMania |
| **[Desktop App](#desktop-app)** | Tauri-based desktop app | Playing with dance pad directly |

---

## Desktop App

Play dance games on your computer with USB dance pad support! Downloads from YouTube, generates charts automatically.

### Prerequisites

- **Deno** - Required by yt-dlp for YouTube's JavaScript challenges
  - macOS: `brew install deno`
  - Linux: `curl -fsSL https://deno.land/install.sh | sh`
- **ffmpeg** - Audio conversion
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt install ffmpeg`
- **yt-dlp** - YouTube downloads
  - `pip install yt-dlp` or `brew install yt-dlp`

### Development Setup

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Linux only: Install Tauri system dependencies
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Install Tauri CLI
cargo install tauri-cli --version "^2"

# Install web dependencies
cd web
npm install
```

### Local Testing

```bash
cd web

# Run in development mode (hot-reload enabled)
npm run tauri:dev
```

This will:
1. Start the Vite dev server on http://localhost:5173
2. Compile the Rust backend (~1-2 min first time)
3. Launch the desktop app window

**Test the full flow:**
1. Click **Library** → **Add Song**
2. Paste a YouTube URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
3. Wait for download + processing (~30-60 seconds)
4. Go to **Play** → Select song → Choose difficulty → **Start Game**
5. Play with arrow keys or USB dance pad!

**Check dependencies:** The app auto-detects yt-dlp, Deno, ffmpeg, and browser cookies. If YouTube blocks downloads, it automatically retries using cookies from Chrome/Firefox.

### Troubleshooting

**"yt-dlp not found"**
```bash
pip install yt-dlp
# or
brew install yt-dlp  # macOS
```

**"YouTube bot detection triggered"**
1. Install Deno: `curl -fsSL https://deno.land/install.sh | sh`
2. If still failing, log into YouTube in Chrome/Firefox - the app will use your browser cookies as fallback

**Rust compilation errors on Linux**
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

**Window doesn't open**
- Check terminal for errors
- Ensure port 5173 is free
- Try `npm run tauri:dev` again

### Building

```bash
cd web
npm run tauri build
```

This creates platform-specific installers in `web/src-tauri/target/release/bundle/`.

**Features:**
- Download songs from YouTube
- Automatic beat detection and chart generation
- Dance pad support via Gamepad API
- Keyboard controls (Arrow keys)
- Song library with local storage

---

## CLI Version

A Python tool that creates ready-to-distribute StepMania packages with beat detection powered by `librosa`.

Based on the original [AutoStepper](https://github.com/phr00t/AutoStepper) by [phr00t](https://github.com/phr00t).

## Features

- **One command** → distribution-ready .zip package
- **YouTube or local audio** - works with both
- **All difficulties** - Easy, Medium, Hard, Challenge in one .ssc file
- **Auto-cleanup** - no intermediate files left behind
- **ITGMania compatible** - modern .ssc format

## Quick Start

```bash
# Set up (first time only)
python3 -m venv venv
source venv/bin/activate  # Linux/macOS (or venv\Scripts\activate on Windows)
pip install -r requirements.txt

# From YouTube
python autostepper.py -u "https://www.youtube.com/watch?v=VIDEO_ID"

# From local file
python autostepper.py -i "path/to/song.mp3"

# With options
python autostepper.py -i song.mp3 --title "My Song" --artist "Artist" -v
```

**Output:** `stepmania_packages/Artist-Title.zip` ready to distribute.

## Usage

```
python autostepper.py [OPTIONS]

Options:
  -i, --input TEXT   Local audio file (MP3, WAV, FLAC, etc.)
  -u, --url TEXT     YouTube video URL
  -o, --output TEXT  Output directory for .zip [default: ./stepmania_packages]
  --title TEXT       Override song title
  --artist TEXT      Override artist name
  -v, --verbose      Verbose output
  --help             Show this message
```

## Installation

Recipients of your .zip files just need to:
1. Extract to `StepMania/Songs/`
2. Refresh song list (F5)
3. Play!

## Package Contents

Each .zip contains:
```
Artist-Song_Title/
├── song.mp3        # Audio
├── song.ssc        # Chart (all 4 difficulties)
├── banner.png      # Auto-generated banner
└── README.txt      # Installation instructions
```

## How It Works

1. **Audio Analysis** - librosa detects beats and tempo
2. **Chart Generation** - Creates step patterns for 4 difficulty levels
3. **Packaging** - Bundles everything into a distributable .zip
4. **Cleanup** - Removes all intermediate files

## Dependencies

- `librosa` - Beat detection
- `yt-dlp` - YouTube downloads (optional, for --url)
- `Pillow` - Banner generation
- `click` - CLI interface

## Credits

- Original concept: [phr00t/AutoStepper](https://github.com/phr00t/AutoStepper)
- Beat detection: [librosa](https://librosa.org/)
