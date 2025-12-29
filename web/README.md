# AutoStepper Web

Browser-based dance game that downloads music from YouTube, generates step charts, and supports dance pad input via the Gamepad API.

> **Note:** This is the web frontend. It requires the Tauri desktop wrapper to handle YouTube downloads. See the main [README.md](../README.md) for setup instructions.

## Features

- Download songs from YouTube
- Automatic beat detection and chart generation
- 4 difficulty levels (Easy, Medium, Hard, Expert)
- Dance pad support via Gamepad API
- Keyboard controls (Arrow keys or WASD)
- Song library with IndexedDB storage
- Playlist management
- ITGMania-inspired scoring system

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
│   │   ├── api/          # YouTube download API client
│   │   ├── audio/        # Beat detection (Web Audio API)
│   │   ├── charts/       # Step chart generation
│   │   ├── components/   # Svelte components
│   │   ├── game/         # Game engine (input, scoring, renderer)
│   │   └── storage/      # IndexedDB (Dexie.js)
│   └── routes/           # SvelteKit pages
├── src-tauri/            # Tauri Rust backend (YouTube downloads)
├── .env.example          # Environment template
└── package.json
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (requires Tauri CLI)
npm run tauri dev

# Type checking
npm run check

# Build desktop app
npm run tauri build
```

## Troubleshooting

### "YouTube bot detection" or "Sign in to confirm you're not a bot"
The Tauri backend uses yt-dlp which requires Deno to solve YouTube's JavaScript challenges:
```bash
# macOS
brew install deno

# Linux
curl -fsSL https://deno.land/install.sh | sh
```

If you still get errors, the app can use your browser cookies:
- Ensure you're logged into YouTube in Chrome/Firefox
- The app will automatically attempt to use browser cookies

### Dance pad not detected
- Connect the pad before opening the game
- Press a button on the pad to wake it up
- Check browser permissions for gamepad access
- Try a different USB port

### Audio not playing
- Check browser console for errors
- Make sure the song status is "ready" in the library
- Try refreshing and re-adding the song
