#!/usr/bin/env python3
"""
YouTube Audio Downloader for AutoStepper MVP

Downloads audio from YouTube videos for testing beat detection.
Uses yt-dlp (best youtube-dl fork) to extract audio in various formats.
"""

import os
import sys
from pathlib import Path
import subprocess
import tempfile
import click


def check_ffmpeg():
    """Check if FFmpeg is available"""
    try:
        subprocess.run(['ffmpeg', '-version'],
                      capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def install_ytdlp():
    """Install yt-dlp if not available"""
    try:
        import yt_dlp

        # Check FFmpeg dependency
        if not check_ffmpeg():
            print("⚠️  FFmpeg not found! yt-dlp needs it for audio extraction.")
            print("📖 Quick install options:")
            print("   macOS: brew install ffmpeg")
            print("   Ubuntu: sudo apt install ffmpeg")
            print("   Windows: Download from https://ffmpeg.org/")
            print("💡 Or try the fallback method below...")
            return False

        return True
    except ImportError:
        print("📦 Installing yt-dlp...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "yt-dlp"])
            print("✅ yt-dlp installed successfully!")

            # Still need to check FFmpeg
            if not check_ffmpeg():
                print("⚠️  Still need FFmpeg - see instructions above")
                return False

            return True
        except subprocess.CalledProcessError:
            print("❌ Failed to install yt-dlp")
            return False


def download_audio_ytdlp(youtube_url, output_dir="./downloads", format_preference="mp3"):
    """Download audio from YouTube using yt-dlp"""

    if not install_ytdlp():
        return None

    import yt_dlp

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)

    # Configure yt-dlp options
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(output_dir / '%(title)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': format_preference,
            'preferredquality': '192',
        }],
        'extractaudio': True,
        'audioformat': format_preference,
        'noplaylist': True,  # Only download single video, not playlists
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"🎵 Downloading audio from: {youtube_url}")

            # Get video info first
            info = ydl.extract_info(youtube_url, download=False)
            title = info.get('title', 'Unknown')
            duration = info.get('duration', 0)

            print(f"   Title: {title}")
            print(f"   Duration: {duration//60}:{duration%60:02d}")

            # Download the audio
            ydl.download([youtube_url])

            # Find the downloaded file
            expected_filename = f"{title}.{format_preference}"
            downloaded_file = output_dir / expected_filename

            # yt-dlp might sanitize filename, so find the actual file
            for file_path in output_dir.glob(f"*.{format_preference}"):
                if file_path.stat().st_mtime > (len(os.listdir(output_dir)) - 1):  # Recently created
                    downloaded_file = file_path
                    break

            if downloaded_file.exists():
                print(f"✅ Downloaded: {downloaded_file}")
                return str(downloaded_file)
            else:
                # Fallback: find any recent audio file
                audio_files = list(output_dir.glob("*.mp3")) + list(output_dir.glob("*.wav")) + list(output_dir.glob("*.m4a"))
                if audio_files:
                    latest_file = max(audio_files, key=lambda f: f.stat().st_mtime)
                    print(f"✅ Downloaded: {latest_file}")
                    return str(latest_file)
                else:
                    print("❌ Could not find downloaded audio file")
                    return None

    except Exception as e:
        print(f"❌ Download failed: {str(e)}")
        return None


def quick_test_with_youtube(youtube_url, difficulty='medium'):
    """Download from YouTube and immediately test with AutoStepper"""

    print("🎵 YouTube → AutoStepper Pipeline Test")
    print("=" * 50)

    # Step 1: Download audio
    audio_file = download_audio_ytdlp(youtube_url)

    if not audio_file:
        print("❌ Could not download audio, aborting test")
        return False

    # Step 2: Run AutoStepper
    print(f"\n🤖 Running AutoStepper on downloaded audio...")
    autostepper_cmd = [
        sys.executable, "autostepper.py",
        "-i", audio_file,
        "-d", difficulty,
        "-o", "./youtube_charts/",
        "-v"
    ]

    try:
        result = subprocess.run(autostepper_cmd, check=True, capture_output=True, text=True)
        print("✅ AutoStepper completed successfully!")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print("❌ AutoStepper failed:")
        print(e.stdout)
        print(e.stderr)
        return False


@click.command()
@click.option('--url', '-u', required=True, help='YouTube video URL')
@click.option('--output', '-o', default='./downloads', help='Download directory')
@click.option('--format', '-f', default='mp3',
              type=click.Choice(['mp3', 'wav', 'm4a']),
              help='Audio format')
@click.option('--test', is_flag=True, help='Run AutoStepper immediately after download')
@click.option('--difficulty', '-d', default='medium',
              type=click.Choice(['easy', 'medium', 'hard', 'expert']),
              help='AutoStepper difficulty (only with --test)')
def main(url, output, format, test, difficulty):
    """Download audio from YouTube and optionally test with AutoStepper"""

    if test:
        success = quick_test_with_youtube(url, difficulty)
        sys.exit(0 if success else 1)
    else:
        audio_file = download_audio_ytdlp(url, output, format)
        if audio_file:
            print(f"\n🎉 Ready to test with AutoStepper:")
            print(f"source venv/bin/activate")
            print(f"python autostepper.py -i '{audio_file}' -d {difficulty} -v")
        sys.exit(0 if audio_file else 1)


def download_without_ffmpeg(youtube_url, output_dir="./downloads"):
    """Fallback: Download best available audio without FFmpeg conversion"""

    if not install_ytdlp():
        return None

    import yt_dlp

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)

    # Simplified options - no audio conversion (no FFmpeg needed)
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',  # Prefer native formats
        'outtmpl': str(output_dir / '%(title)s.%(ext)s'),
        'noplaylist': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"🎵 Downloading audio (no conversion) from: {youtube_url}")
            print("📝 Note: Audio might be in M4A/WebM format (librosa can handle this)")

            # Get info and download
            info = ydl.extract_info(youtube_url, download=False)
            title = info.get('title', 'Unknown')
            duration = info.get('duration', 0)

            print(f"   Title: {title}")
            print(f"   Duration: {duration//60}:{duration%60:02d}")

            ydl.download([youtube_url])

            # Find the downloaded file
            audio_extensions = ['*.m4a', '*.webm', '*.mp4', '*.mp3', '*.aac']
            for pattern in audio_extensions:
                files = list(output_dir.glob(pattern))
                if files:
                    latest_file = max(files, key=lambda f: f.stat().st_mtime)
                    print(f"✅ Downloaded: {latest_file}")
                    return str(latest_file)

            print("❌ Could not find downloaded audio file")
            return None

    except Exception as e:
        print(f"❌ Download failed: {str(e)}")
        return None


# Alternative: Simple function using subprocess (if yt-dlp import fails)
def download_with_subprocess(url, output_dir="./downloads"):
    """Fallback method using yt-dlp as subprocess"""

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)

    # Try without FFmpeg first
    cmd = [
        "yt-dlp",
        "-f", "bestaudio[ext=m4a]/bestaudio",
        "-o", str(output_dir / "%(title)s.%(ext)s"),
        url
    ]

    try:
        print(f"🎵 Downloading with command: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("✅ Download completed!")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Download failed: {e}")
        print(e.stderr)
        print("💡 Try installing FFmpeg or use the no-conversion method")
        return False
    except FileNotFoundError:
        print("❌ yt-dlp not found. Install with: pip install yt-dlp")
        return False


if __name__ == '__main__':
    main()