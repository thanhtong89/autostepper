# AutoStepper Web

Browser-based dance game that downloads music from YouTube, generates step charts, and supports dance pad input via the Gamepad API.

## Features

- Download songs from YouTube (via local server or AWS Lambda)
- Automatic beat detection and chart generation
- 4 difficulty levels (Easy, Medium, Hard, Expert)
- Dance pad support via Gamepad API
- Keyboard controls (Arrow keys or WASD)
- Song library with IndexedDB storage
- Playlist management
- ITGMania-inspired scoring system

## Quick Start (Local Development)

### Prerequisites

- **Node.js 18+** - JavaScript runtime
- **Python 3.9+** - For the local download server
- **Deno** - Required by yt-dlp for YouTube's JavaScript challenges
  - macOS: `brew install deno`
  - Linux: `curl -fsSL https://deno.land/install.sh | sh`
  - Windows: `irm https://deno.land/install.ps1 | iex`
- **ffmpeg** - Audio conversion (required by yt-dlp)
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt install ffmpeg`

### 1. Install Dependencies

```bash
# Python dependencies (from project root)
cd /path/to/autostepper
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
pip install -r requirements.txt

# Web frontend
cd web
npm install
```

### 2. Configure Environment

```bash
cd web
cp .env.example .env
```

The default `.env` is configured for local development:
```
VITE_LAMBDA_URL=http://localhost:5000/download
```

### 3. Start the Local Download Server

In one terminal:
```bash
cd /path/to/autostepper
source venv/bin/activate
python infrastructure/local/server.py
```

You should see:
```
╔═══════════════════════════════════════════════════════════════╗
║           AutoStepper Local Development Server                ║
╠═══════════════════════════════════════════════════════════════╣
║  Server:     http://127.0.0.1:5000
║  Endpoints:                                                   ║
║    POST /download     - Download audio from YouTube           ║
║    GET  /audio/*.mp3  - Serve downloaded audio                ║
║    GET  /health       - Health check                          ║
║    POST /cleanup      - Delete all downloaded files           ║
╚═══════════════════════════════════════════════════════════════╝
✓ yt-dlp found
✓ ffmpeg found
```

### 4. Start the Web Frontend

In another terminal:
```bash
cd web
npm run dev
```

Open http://localhost:5173 in your browser.

### 5. Test the Full Flow

1. Go to **Library** → **Add Song**
2. Paste a YouTube URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
3. Wait for download and processing (~30-60 seconds)
4. Go to **Play** → Select your song → Choose difficulty → **Start Game**
5. Play with arrow keys or connect a USB dance pad!

## Local Server API

The local development server (`infrastructure/local/server.py`) provides:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/download` | POST | Download audio from YouTube URL |
| `/audio/{id}.mp3` | GET | Serve downloaded audio file |
| `/health` | GET | Health check (shows yt-dlp/ffmpeg status) |
| `/cleanup` | POST | Delete all downloaded files |

### Example API Usage

```bash
# Download a song
curl -X POST http://localhost:5000/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'

# Response:
{
  "id": "uuid",
  "title": "Video Title",
  "artist": "Channel Name",
  "duration": 180,
  "thumbnail": "https://...",
  "downloadUrl": "http://localhost:5000/audio/uuid.mp3",
  "fileSize": 1234567
}

# Health check
curl http://localhost:5000/health
```

## Production Deployment

For production, deploy the AWS Lambda function instead of using the local server:

1. Deploy infrastructure:
   ```bash
   cd infrastructure/terraform
   terraform init
   terraform apply
   ```

2. Update `.env` with the Lambda URL:
   ```
   VITE_LAMBDA_URL=https://xxxxx.lambda-url.us-east-1.on.aws/
   ```

3. Build and deploy the web app:
   ```bash
   npm run build
   # Deploy to Vercel, Netlify, or any static host
   ```

See `infrastructure/README.md` for detailed AWS setup instructions.

## Game Controls

| Action | Keyboard | Dance Pad |
|--------|----------|-----------|
| Left Arrow | ← or A | Left panel |
| Down Arrow | ↓ or S | Down panel |
| Up Arrow | ↑ or W | Up panel |
| Right Arrow | → or D | Right panel |
| Pause | Escape | Start button |

## Project Structure

```
web/
├── src/
│   ├── lib/
│   │   ├── api/          # Lambda/server API client
│   │   ├── audio/        # Beat detection (Web Audio API)
│   │   ├── charts/       # Step chart generation
│   │   ├── components/   # Svelte components
│   │   ├── game/         # Game engine (input, scoring, renderer)
│   │   └── storage/      # IndexedDB (Dexie.js)
│   └── routes/           # SvelteKit pages
├── .env.example          # Environment template
└── package.json
```

## Troubleshooting

### "Lambda URL not configured"
Make sure you've created `.env` from `.env.example` and the local server is running.

### "YouTube bot detection" or "Sign in to confirm you're not a bot"
YouTube requires Deno to solve JavaScript challenges. Install Deno:
```bash
# macOS
brew install deno

# Linux
curl -fsSL https://deno.land/install.sh | sh

# Add to PATH if needed
export PATH="$HOME/.deno/bin:$PATH"
```

If you still get errors with Deno installed, try using browser cookies:
```bash
python infrastructure/local/server.py --cookies-from-browser chrome
```

### yt-dlp not found
```bash
pip install yt-dlp
# or
brew install yt-dlp  # macOS
```

### ffmpeg not found
- **macOS**: `brew install ffmpeg`
- **Ubuntu**: `sudo apt install ffmpeg`
- **Windows**: Download from https://ffmpeg.org/download.html

### Deno not found
```bash
# macOS
brew install deno

# Linux
curl -fsSL https://deno.land/install.sh | sh

# Verify installation
deno --version
```

### Dance pad not detected
- Connect the pad before opening the game
- Press a button on the pad to wake it up
- Check browser permissions for gamepad access
- Try a different USB port

### Audio not playing
- Check browser console for errors
- Make sure the song status is "ready" in the library
- Try refreshing and re-adding the song

## Development

```bash
# Type checking
npm run check

# Build
npm run build

# Preview production build
npm run preview
```
