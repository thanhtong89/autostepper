# AutoStepper

**Generate StepMania/ITGMania charts from audio or YouTube**

Two ways to use AutoStepper:

| Version | Description | Best For |
|---------|-------------|----------|
| **[CLI](#cli-version)** | Python command-line tool | Creating .zip packages for StepMania/ITGMania |
| **[Web](#web-version)** | Browser-based game | Playing with dance pad directly in browser |

---

## Web Version

Play dance games directly in your browser with USB dance pad support!

```bash
# Install Deno (required for YouTube downloads)
curl -fsSL https://deno.land/install.sh | sh  # Linux
# or: brew install deno  # macOS

# Setup Python (uses same venv as CLI)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup web frontend
cd web
npm install
cp .env.example .env

# Terminal 1: Start local download server
source venv/bin/activate
python infrastructure/local/server.py

# Terminal 2: Start web app
cd web
npm run dev
# Open http://localhost:5173
```

See [web/README.md](web/README.md) for full documentation.

**Features:**
- Download songs from YouTube
- Automatic beat detection and chart generation
- Dance pad support via Gamepad API
- Keyboard controls (Arrow keys)
- Song library with browser storage

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
