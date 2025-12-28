#!/usr/bin/env python3
"""
Complete YouTube to StepMania Pipeline

Downloads YouTube video → Generates step charts → Packages for distribution
All in one command!

Built upon the original AutoStepper concept by phr00t:
https://github.com/phr00t/AutoStepper
"""

import subprocess
import sys
from pathlib import Path
import click


def sanitize_filename(name: str) -> str:
    """Sanitize filename by trimming spaces and replacing invalid characters"""
    name = name.strip()
    for char in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
        name = name.replace(char, '_')
    name = name.replace(' ', '_')
    while '__' in name:
        name = name.replace('__', '_')
    return name


def download_youtube_audio(youtube_url, output_dir="./downloads"):
    """Download audio from YouTube using yt-dlp"""

    print("Step 1: Downloading from YouTube...")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        "yt-dlp",
        "-x",  # Extract audio
        "--audio-format", "mp3",
        "--audio-quality", "0",  # Best quality
        "-o", str(output_dir / "%(title)s.%(ext)s"),
        youtube_url
    ]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("   Download successful!")

        # Find the downloaded file
        audio_files = list(output_dir.glob("*.mp3"))
        if audio_files:
            latest_audio = max(audio_files, key=lambda f: f.stat().st_mtime)
            return latest_audio
        return None

    except subprocess.CalledProcessError as e:
        print(f"   Download failed: {e.stderr}")
        return None
    except FileNotFoundError:
        print("   Error: yt-dlp not found. Install with: pip install yt-dlp")
        return None


def generate_chart(audio_file, output_dir="./youtube_charts"):
    """Generate step chart with all difficulties"""

    print("Step 2: Generating step chart...")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable, "autostepper.py",
        "-i", str(audio_file),
        "-o", str(output_dir),
        "-v"
    ]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(result.stdout)

        # Find the generated chart file
        chart_files = list(output_dir.glob("*.ssc"))
        if chart_files:
            latest_chart = max(chart_files, key=lambda f: f.stat().st_mtime)
            return latest_chart
        return None

    except subprocess.CalledProcessError as e:
        print(f"   Chart generation failed: {e.stderr}")
        return None


def create_stepmania_package(audio_file, chart_file, output_dir="./stepmania_packages"):
    """Create a complete StepMania/ITGMania package"""

    print("Step 3: Creating StepMania package...")

    from package_song import create_song_package, create_zip_package

    try:
        package_dir = create_song_package(
            audio_file=audio_file,
            chart_file=chart_file,
            output_dir=output_dir,
            include_banner=True
        )

        zip_path = create_zip_package(package_dir)
        return package_dir, zip_path

    except Exception as e:
        print(f"   Packaging failed: {e}")
        return None, None


@click.command()
@click.option('--url', '-u', required=True, help='YouTube video URL')
@click.option('--package/--no-package', default=True,
              help='Create StepMania package for distribution')
@click.option('--output', '-o', default='./youtube_charts',
              help='Output directory for charts')
def main(url, package, output):
    """Complete YouTube to StepMania/ITGMania pipeline"""

    print("YouTube to StepMania Pipeline")
    print("=" * 50)
    print(f"URL: {url}")
    print(f"Package: {'Yes' if package else 'No'}")
    print()

    # Step 1: Download audio from YouTube
    audio_file = download_youtube_audio(url)
    if not audio_file:
        print("Could not download audio from YouTube")
        sys.exit(1)

    print(f"   Audio: {audio_file.name}")

    # Step 2: Generate chart (all difficulties in one .ssc file)
    chart_file = generate_chart(audio_file, output_dir=output)
    if not chart_file:
        print("Could not generate step chart")
        sys.exit(1)

    print(f"   Chart: {chart_file.name}")

    # Step 3: Create StepMania package if requested
    if package:
        package_dir, zip_path = create_stepmania_package(audio_file, chart_file)

        if package_dir and zip_path:
            print(f"\nPipeline complete!")
            print(f"Package folder: {package_dir}")
            print(f"Distribution zip: {zip_path}")
            print(f"\nTo use with ITGMania/StepMania:")
            print(f"   1. Extract {zip_path.name} to your Songs folder")
            print(f"   2. Refresh song list (F5)")
            print(f"   3. Play!")
        else:
            print("Packaging failed")
            sys.exit(1)
    else:
        print(f"\nChart generation complete!")
        print(f"Audio: {audio_file}")
        print(f"Chart: {chart_file}")


if __name__ == '__main__':
    main()
