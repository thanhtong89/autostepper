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
import shutil
from pathlib import Path
import click
import tempfile
import zipfile


def run_youtube_download(youtube_url, difficulty='medium'):
    """Download from YouTube and generate charts"""

    print("🎵 Step 1: Downloading from YouTube...")

    # Use our existing download script
    cmd = [
        sys.executable, "download_demo.py",
        "-u", youtube_url,
        "--test",
        "-d", difficulty
    ]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("✅ Download and chart generation successful!")
        return True
    except subprocess.CalledProcessError as e:
        print("❌ YouTube download failed:")
        print(e.stdout)
        print(e.stderr)
        return False


def find_generated_files():
    """Find the most recently generated audio and chart files"""

    downloads_dir = Path("./downloads")
    charts_dir = Path("./youtube_charts")

    if not downloads_dir.exists() or not charts_dir.exists():
        return None, []

    # Find most recent audio file
    audio_files = []
    for ext in ['*.mp3', '*.m4a', '*.wav', '*.webm']:
        audio_files.extend(downloads_dir.glob(ext))

    if not audio_files:
        return None, []

    latest_audio = max(audio_files, key=lambda f: f.stat().st_mtime)

    # Find corresponding chart files
    # Get base name without extension
    base_name = latest_audio.stem

    # Find all .sm files that start with this base name
    chart_files = []
    for sm_file in charts_dir.glob("*.sm"):
        if sm_file.stem.startswith(base_name.replace(" ", "_")):
            chart_files.append(sm_file)

    return latest_audio, chart_files


def generate_all_difficulties(audio_file):
    """Generate charts for all difficulty levels"""

    difficulties = ['easy', 'medium', 'hard', 'expert']

    print("🎯 Step 2: Generating all difficulty charts...")

    for difficulty in difficulties:
        print(f"   Generating {difficulty} chart...")

        cmd = [
            sys.executable, "autostepper.py",
            "-i", str(audio_file),
            "-d", difficulty,
            "-o", "./youtube_charts/",
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f"   ✅ {difficulty.capitalize()} chart created")
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Failed to create {difficulty} chart")
            print(e.stderr)


def create_stepmania_package(audio_file, chart_files):
    """Create a complete StepMania package"""

    print("📦 Step 3: Creating StepMania package...")

    # Import the packaging functions
    from package_song import create_song_package, create_zip_package

    try:
        package_dir = create_song_package(
            audio_file=audio_file,
            sm_files=chart_files,
            output_dir="./stepmania_packages",
            include_banner=True
        )

        # Create zip file for easy distribution
        zip_path = create_zip_package(package_dir)

        return package_dir, zip_path

    except Exception as e:
        print(f"❌ Packaging failed: {e}")
        return None, None


@click.command()
@click.option('--url', '-u', required=True, help='YouTube video URL')
@click.option('--all-difficulties/--single-difficulty', default=True,
              help='Generate all difficulty levels')
@click.option('--difficulty', '-d', default='medium',
              type=click.Choice(['easy', 'medium', 'hard', 'expert']),
              help='Difficulty level (if not generating all)')
@click.option('--package/--no-package', default=True,
              help='Create StepMania package for distribution')
def main(url, all_difficulties, difficulty, package):
    """Complete YouTube to StepMania pipeline"""

    print("🎵 YouTube → StepMania Complete Pipeline")
    print("=" * 50)
    print(f"🔗 URL: {url}")
    print(f"🎯 Mode: {'All difficulties' if all_difficulties else f'{difficulty} only'}")
    print(f"📦 Package: {'Yes' if package else 'No'}")
    print()

    # Step 1: Download and generate initial chart
    success = run_youtube_download(url, difficulty)
    if not success:
        sys.exit(1)

    # Find the downloaded files
    audio_file, initial_charts = find_generated_files()
    if not audio_file:
        print("❌ Could not find downloaded audio file")
        sys.exit(1)

    print(f"📁 Found audio: {audio_file.name}")
    print(f"📄 Found {len(initial_charts)} initial charts")

    # Step 2: Generate all difficulties if requested
    if all_difficulties:
        generate_all_difficulties(audio_file)

        # Re-scan for all chart files
        _, all_charts = find_generated_files()
        chart_files = all_charts
    else:
        chart_files = initial_charts

    if not chart_files:
        print("❌ No chart files found")
        sys.exit(1)

    print(f"📊 Total charts: {len(chart_files)}")
    for chart in chart_files:
        print(f"   - {chart.name}")

    # Step 3: Create StepMania package if requested
    if package:
        package_dir, zip_path = create_stepmania_package(audio_file, chart_files)

        if package_dir and zip_path:
            print(f"\n🎉 Complete pipeline successful!")
            print(f"📁 Package folder: {package_dir}")
            print(f"📦 Distribution zip: {zip_path}")
            print(f"\n🎮 Ready to share with StepMania users:")
            print(f"   1. Send them: {zip_path.name}")
            print(f"   2. They extract to StepMania/Songs/")
            print(f"   3. They refresh StepMania (F5) and play!")
        else:
            print("❌ Packaging failed")
            sys.exit(1)
    else:
        print(f"\n🎉 Chart generation complete!")
        print(f"📁 Audio: {audio_file}")
        print(f"📄 Charts: {len(chart_files)} files in ./youtube_charts/")


if __name__ == '__main__':
    main()