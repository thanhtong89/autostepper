#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Local development server for testing AutoStepper without AWS.

This server mimics the Lambda function's behavior:
1. Accepts YouTube URLs
2. Downloads audio using yt-dlp
3. Serves the audio file directly (instead of S3)

Usage:
    python server.py [--port PORT] [--host HOST] [--cookies-from-browser BROWSER]

Requirements:
    pip install flask flask-cors yt-dlp
    ffmpeg (for audio conversion)
    deno (for YouTube JS challenges) - install from https://deno.land

Note:
    yt-dlp requires Deno to handle YouTube's JavaScript challenges.
    If you still get bot detection errors, use --cookies-from-browser
    to authenticate with your YouTube login.
"""

import json
import subprocess
import os
import uuid
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Directory to store downloaded audio files
AUDIO_DIR = Path(tempfile.gettempdir()) / 'autostepper_audio'
AUDIO_DIR.mkdir(exist_ok=True)

# Track downloaded files (in-memory, resets on server restart)
downloads = {}

# Optional: Browser to extract cookies from (set via CLI argument)
COOKIES_BROWSER = None


def validate_youtube_url(url: str) -> bool:
    """Validate that the URL is a legitimate YouTube URL."""
    if not url:
        return False

    parsed = urlparse(url)
    valid_hosts = [
        'youtube.com', 'www.youtube.com', 'm.youtube.com',
        'youtu.be', 'www.youtu.be',
        'youtube-nocookie.com', 'www.youtube-nocookie.com'
    ]

    return parsed.netloc in valid_hosts


def find_deno_path():
    """Find Deno executable path."""
    import shutil

    # Check common installation locations FIRST (more reliable than PATH)
    home = Path.home()
    common_paths = [
        home / '.deno' / 'bin' / 'deno',           # Linux/macOS default install
        Path('/usr/local/bin/deno'),                # Homebrew / manual install
        Path('/opt/homebrew/bin/deno'),             # Homebrew on Apple Silicon
        Path('/usr/bin/deno'),                      # System install
        home / '.local' / 'bin' / 'deno',           # Alternative Linux
    ]

    for path in common_paths:
        if path.exists():
            return str(path)

    # Fall back to PATH search (might find unexpected locations)
    deno_path = shutil.which('deno')
    if deno_path:
        return deno_path

    return None


def check_deno_installed():
    """Check if Deno is installed."""
    return find_deno_path() is not None


def build_ytdlp_command(base_args: list, output_path: str = None) -> list:
    """Build yt-dlp command with optional cookies and Deno path."""
    cmd = ['yt-dlp'] + base_args

    # Always add Deno path if found (needed for JS challenge solving)
    deno_path = find_deno_path()
    if deno_path:
        cmd.extend(['--js-runtimes', f'deno:{deno_path}'])
        # Allow downloading the challenge solver script from GitHub
        cmd.extend(['--remote-components', 'ejs:github'])

    # Add cookies if specified (for authentication)
    if COOKIES_BROWSER:
        cmd.extend(['--cookies-from-browser', COOKIES_BROWSER])

    if output_path:
        cmd.extend(['-o', output_path])

    return cmd


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    # Check if yt-dlp is available
    try:
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True)
        ytdlp_version = result.stdout.strip() if result.returncode == 0 else 'not found'
    except FileNotFoundError:
        ytdlp_version = 'not installed'

    # Check if ffmpeg is available
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        ffmpeg_available = result.returncode == 0
    except FileNotFoundError:
        ffmpeg_available = False

    # Check if Deno is available
    deno_path = find_deno_path()

    return jsonify({
        'status': 'ok',
        'yt-dlp': ytdlp_version,
        'ffmpeg': 'available' if ffmpeg_available else 'not found',
        'deno': deno_path if deno_path else 'NOT FOUND - required for YouTube!',
        'cookies_browser': COOKIES_BROWSER or 'not configured (using Deno)',
        'audio_dir': str(AUDIO_DIR),
        'downloads_count': len(downloads)
    })


@app.route('/download', methods=['POST', 'OPTIONS'])
def download_audio():
    """
    Download audio from YouTube URL.

    Request body:
        {"url": "https://www.youtube.com/watch?v=..."}

    Response:
        {
            "id": "uuid",
            "title": "Video Title",
            "artist": "Channel Name",
            "duration": 180,
            "thumbnail": "https://...",
            "downloadUrl": "http://localhost:5000/audio/uuid.mp3",
            "fileSize": 1234567
        }
    """
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 200

    try:
        body = request.get_json() or {}
        youtube_url = body.get('url', '').strip()

        # Validate URL
        if not youtube_url:
            return jsonify({'error': 'Missing URL parameter'}), 400

        if not validate_youtube_url(youtube_url):
            return jsonify({'error': 'Invalid YouTube URL'}), 400

        # Check Deno if not using cookies
        if not COOKIES_BROWSER and not check_deno_installed():
            return jsonify({
                'error': 'Deno is required for YouTube downloads. Install from https://deno.land or use --cookies-from-browser flag.'
            }), 500

        # Generate unique song ID
        song_id = str(uuid.uuid4())
        output_path = AUDIO_DIR / f'{song_id}.mp3'

        print(f'[{song_id}] Fetching metadata for: {youtube_url}')

        # First, get video metadata
        metadata_cmd = build_ytdlp_command([
            '--dump-json',
            '--no-download',
            youtube_url
        ])

        print(f'[{song_id}] Running: {" ".join(metadata_cmd)}')

        metadata_result = subprocess.run(
            metadata_cmd,
            capture_output=True,
            text=True,
            timeout=60
        )

        if metadata_result.returncode != 0:
            error_msg = metadata_result.stderr or 'Unknown error fetching metadata'
            print(f'[{song_id}] Metadata error: {error_msg}')

            # Provide helpful error messages
            if 'Sign in to confirm' in error_msg or 'bot' in error_msg.lower():
                hint = 'Try: python server.py --cookies-from-browser chrome' if not COOKIES_BROWSER else f'Your {COOKIES_BROWSER} cookies may have expired. Try logging into YouTube again.'
                return jsonify({
                    'error': f'YouTube bot detection triggered. {hint}'
                }), 400
            if 'No supported JavaScript runtime' in error_msg:
                return jsonify({
                    'error': 'Deno not found. Install from https://deno.land'
                }), 500

            return jsonify({'error': f'Failed to fetch video info: {error_msg}'}), 400

        metadata = json.loads(metadata_result.stdout)
        print(f'[{song_id}] Title: {metadata.get("title", "Unknown")}')

        # Download audio with yt-dlp
        print(f'[{song_id}] Downloading audio...')
        download_cmd = build_ytdlp_command([
            '-x',                               # Extract audio
            '--audio-format', 'mp3',            # Convert to MP3
            '--audio-quality', '0',             # Best quality
            '--no-playlist',                    # Don't download playlists
            '--max-filesize', '50m',            # Limit file size
            '--progress',                       # Show progress
            youtube_url
        ], output_path=str(output_path))

        download_result = subprocess.run(
            download_cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout for local dev
        )

        if download_result.returncode != 0:
            error_msg = download_result.stderr or 'Unknown download error'
            print(f'[{song_id}] Download error: {error_msg}')
            return jsonify({'error': f'Download failed: {error_msg}'}), 500

        # yt-dlp might output to slightly different path
        actual_path = None
        possible_paths = [
            output_path,
            AUDIO_DIR / f'{song_id}.mp3',
            AUDIO_DIR / f'{song_id}.m4a',
            AUDIO_DIR / f'{song_id}.webm',
        ]

        for path in possible_paths:
            if path.exists():
                actual_path = path
                break

        if not actual_path:
            # Check for any file starting with song_id
            for f in AUDIO_DIR.iterdir():
                if f.stem == song_id:
                    actual_path = f
                    break

        if not actual_path:
            print(f'[{song_id}] File not found after download')
            return jsonify({'error': 'Downloaded file not found'}), 500

        # Rename to .mp3 if needed
        if actual_path.suffix != '.mp3':
            new_path = actual_path.with_suffix('.mp3')
            actual_path.rename(new_path)
            actual_path = new_path

        file_size = actual_path.stat().st_size
        print(f'[{song_id}] Download complete: {file_size / 1024 / 1024:.2f} MB')

        # Store download info
        downloads[song_id] = {
            'path': str(actual_path),
            'metadata': metadata
        }

        # Build download URL (local server)
        download_url = f'http://{request.host}/audio/{song_id}.mp3'

        response_data = {
            'id': song_id,
            'title': metadata.get('title', 'Unknown'),
            'artist': metadata.get('uploader', metadata.get('channel', 'Unknown')),
            'duration': metadata.get('duration', 0),
            'thumbnail': metadata.get('thumbnail', ''),
            'downloadUrl': download_url,
            'fileSize': file_size
        }

        return jsonify(response_data)

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Download timed out'}), 504
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    except Exception as e:
        print(f'Error: {str(e)}')
        return jsonify({'error': f'Internal error: {str(e)}'}), 500


@app.route('/audio/<song_id>.mp3', methods=['GET'])
def serve_audio(song_id):
    """Serve downloaded audio file."""
    audio_path = AUDIO_DIR / f'{song_id}.mp3'

    if not audio_path.exists():
        return jsonify({'error': 'Audio file not found'}), 404

    return send_file(
        audio_path,
        mimetype='audio/mpeg',
        as_attachment=False,
        download_name=f'{song_id}.mp3'
    )


@app.route('/cleanup', methods=['POST'])
def cleanup():
    """Clean up all downloaded audio files."""
    count = 0
    for f in AUDIO_DIR.iterdir():
        if f.is_file():
            f.unlink()
            count += 1

    downloads.clear()
    return jsonify({'deleted': count})


def main():
    global COOKIES_BROWSER
    import argparse

    parser = argparse.ArgumentParser(
        description='AutoStepper Local Development Server',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Prerequisites:
  - Deno: Required for YouTube downloads (https://deno.land)
  - ffmpeg: Required for audio conversion
  - yt-dlp: YouTube downloader (pip install yt-dlp)

Examples:
  python server.py                              # Default (requires Deno)
  python server.py --cookies-from-browser chrome   # Use Chrome cookies as fallback

If you get bot detection errors even with Deno, try the cookies option.
        '''
    )
    parser.add_argument('--port', type=int, default=5000, help='Port to run on (default: 5000)')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to (default: 127.0.0.1)')
    parser.add_argument('--cookies-from-browser',
                        choices=['chrome', 'firefox', 'edge', 'safari', 'opera', 'brave', 'chromium'],
                        help='Browser to extract YouTube cookies from (optional fallback)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()
    COOKIES_BROWSER = args.cookies_from_browser

    # Check dependencies
    print('\nChecking dependencies...')

    # yt-dlp
    try:
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f'  ✓ yt-dlp {result.stdout.strip()}')
        else:
            print('  ✗ yt-dlp not working')
            return
    except FileNotFoundError:
        print('  ✗ yt-dlp not found - install with: pip install yt-dlp')
        return

    # ffmpeg
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        print('  ✓ ffmpeg')
    except (subprocess.CalledProcessError, FileNotFoundError):
        print('  ✗ ffmpeg not found - required for audio conversion')
        print('    Install: https://ffmpeg.org/download.html')
        return

    # Deno
    deno_path = find_deno_path()
    if deno_path:
        result = subprocess.run([deno_path, '--version'], capture_output=True, text=True)
        version = result.stdout.split('\n')[0] if result.returncode == 0 else 'unknown'
        print(f'  ✓ {version}')
        print(f'    Path: {deno_path}')
    else:
        if COOKIES_BROWSER:
            print(f'  ⚠ Deno not found - using {COOKIES_BROWSER} cookies instead')
        else:
            print('  ✗ Deno not found - REQUIRED for YouTube downloads!')
            print('    Install: curl -fsSL https://deno.land/install.sh | sh')
            print('    Or use: --cookies-from-browser chrome')
            return

    auth_method = f'{COOKIES_BROWSER} cookies' if COOKIES_BROWSER else 'Deno (no cookies needed)'

    print(f'''
╔═══════════════════════════════════════════════════════════════╗
║           AutoStepper Local Development Server                ║
╠═══════════════════════════════════════════════════════════════╣
║  Server:     http://{args.host}:{args.port}
║  Auth:       {auth_method}
║  Audio Dir:  {AUDIO_DIR}
║                                                               ║
║  Endpoints:                                                   ║
║    POST /download     - Download audio from YouTube           ║
║    GET  /audio/*.mp3  - Serve downloaded audio                ║
║    GET  /health       - Health check                          ║
║    POST /cleanup      - Delete all downloaded files           ║
╚═══════════════════════════════════════════════════════════════╝
''')

    print('Starting server...\n')
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == '__main__':
    main()
