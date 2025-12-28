#!/usr/bin/env python3
"""
Quick YouTube downloader without FFmpeg requirement

For when you get the "ffmpeg not found" error, this bypasses audio conversion
and downloads native formats that librosa can still handle.
"""

import subprocess
import sys
from pathlib import Path


def quick_download_no_ffmpeg(youtube_url):
    """Download YouTube audio without needing FFmpeg"""

    print("🎵 Quick YouTube Download (No FFmpeg Required)")
    print("=" * 50)
    print(f"URL: {youtube_url}")

    # Create downloads directory
    downloads_dir = Path("./downloads")
    downloads_dir.mkdir(exist_ok=True)

    # Simple yt-dlp command that doesn't need FFmpeg
    cmd = [
        "yt-dlp",
        "-f", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
        "-o", str(downloads_dir / "%(title)s.%(ext)s"),
        "--no-playlist",
        youtube_url
    ]

    try:
        print("🔍 Downloading best available audio format...")
        print(f"Command: {' '.join(cmd)}")

        result = subprocess.run(cmd, check=True, capture_output=True, text=True)

        print("✅ Download completed!")

        # Find the downloaded file
        audio_files = []
        for ext in ['*.m4a', '*.webm', '*.mp4', '*.aac', '*.mp3']:
            audio_files.extend(downloads_dir.glob(ext))

        if audio_files:
            latest_file = max(audio_files, key=lambda f: f.stat().st_mtime)
            print(f"📁 File: {latest_file}")

            # Test with AutoStepper
            print("\n🤖 Testing with AutoStepper...")
            autostepper_cmd = [
                sys.executable, "autostepper.py",
                "-i", str(latest_file),
                "-d", "medium",
                "-v"
            ]

            auto_result = subprocess.run(autostepper_cmd, capture_output=True, text=True)

            if auto_result.returncode == 0:
                print("✅ AutoStepper analysis successful!")
                print(auto_result.stdout)
            else:
                print("⚠️  AutoStepper had issues:")
                print(auto_result.stdout)
                print(auto_result.stderr)

            return str(latest_file)

        else:
            print("❌ No audio files found after download")
            return None

    except subprocess.CalledProcessError as e:
        print(f"❌ Download failed: {e}")
        print("stderr:", e.stderr.decode() if e.stderr else "No error details")

        # Check if yt-dlp is installed
        try:
            subprocess.run(["yt-dlp", "--version"], check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("\n💡 yt-dlp not found! Install with:")
            print("   pip install yt-dlp")

        return None

    except FileNotFoundError:
        print("❌ yt-dlp not found!")
        print("💡 Install with: pip install yt-dlp")
        return None


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python quick_download.py <youtube_url>")
        print("Example: python quick_download.py 'https://youtu.be/dQw4w9WgXcQ'")
        sys.exit(1)

    url = sys.argv[1]
    result = quick_download_no_ffmpeg(url)

    if result:
        print(f"\n🎉 Success! Downloaded: {result}")
        print(f"💡 You can now process other difficulties:")
        for diff in ['easy', 'hard', 'expert']:
            print(f"   python autostepper.py -i '{result}' -d {diff} -v")
    else:
        print("❌ Download failed")
        sys.exit(1)