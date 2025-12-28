#!/usr/bin/env python3
"""
AutoStepper - Generate StepMania/ITGMania charts from audio

Accepts either a YouTube URL or local audio file and produces a
ready-to-distribute .zip package with all difficulties.

Original concept by phr00t: https://github.com/phr00t/AutoStepper
"""

import click
import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
import traceback

from autostepper.audio.analyzer import BeatAnalyzer
from autostepper.stepgen.generator import StepGenerator
from autostepper.formats.stepmania_ssc import SSCExporter
from package_song import create_song_package, create_zip_package, sanitize_filename


def download_youtube_audio(youtube_url, output_dir):
    """Download audio from YouTube, returns path to downloaded file"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        "yt-dlp",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", str(output_dir / "%(title)s.%(ext)s"),
        youtube_url
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        audio_files = list(output_dir.glob("*.mp3"))
        if audio_files:
            return max(audio_files, key=lambda f: f.stat().st_mtime)
        return None
    except subprocess.CalledProcessError as e:
        print(f"YouTube download failed: {e.stderr}", file=sys.stderr)
        return None
    except FileNotFoundError:
        print("Error: yt-dlp not found. Install with: pip install yt-dlp", file=sys.stderr)
        return None


def generate_charts(audio_path, title_override=None, artist_override=None, verbose=False):
    """Analyze audio and generate step charts for all difficulties"""
    print("[2/4] Analyzing audio...")

    analyzer = BeatAnalyzer()
    audio_data = analyzer.load_and_analyze(audio_path)

    if verbose:
        print(f"      BPM: {audio_data['tempo']:.1f}, Beats: {len(audio_data['beats'])}, Confidence: {audio_data.get('confidence', 0.0):.2f}")

    print("[3/4] Generating step charts...")

    charts = StepGenerator.generate_all_difficulties(
        audio_data,
        title_override=title_override,
        artist_override=artist_override
    )

    if verbose:
        steps_info = ", ".join(f"{c['difficulty']['description']}: {len(c['notes'])}" for c in charts)
        print(f"      {steps_info}")

    return charts


def process_audio(audio_path, output_dir, title, artist, verbose):
    """Process audio file and create distribution zip"""

    # Generate charts
    charts = generate_charts(audio_path, title, artist, verbose)

    # Create temp directory for intermediate .ssc file
    with tempfile.TemporaryDirectory() as chart_temp_dir:
        chart_temp_dir = Path(chart_temp_dir)

        # Export .ssc to temp location
        safe_name = sanitize_filename(audio_path.stem)
        ssc_path = chart_temp_dir / f"{safe_name}.ssc"

        exporter = SSCExporter()
        exporter.export_charts(charts, ssc_path)

        # Create package and zip
        print("[4/4] Creating package...")

        package_dir, package_files = create_song_package(
            audio_file=audio_path,
            chart_file=ssc_path,
            output_dir=output_dir,
            include_banner=True,
            quiet=True
        )

        zip_path = create_zip_package(package_dir, package_files, quiet=True)

        # Clean up the package directory (we only want the zip)
        shutil.rmtree(package_dir)

        return zip_path


@click.command()
@click.option('--input', '-i', 'input_path', help='Local audio file (MP3, WAV, FLAC, etc.)')
@click.option('--url', '-u', help='YouTube video URL')
@click.option('--output', '-o', default='./stepmania_packages', help='Output directory for .zip')
@click.option('--title', help='Override song title')
@click.option('--artist', help='Override artist name')
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
def main(input_path, url, output, title, artist, verbose):
    """Generate StepMania/ITGMania chart package from audio or YouTube URL"""

    if not input_path and not url:
        click.echo("Error: Provide either --input (audio file) or --url (YouTube URL)", err=True)
        sys.exit(1)

    if input_path and url:
        click.echo("Error: Provide only one of --input or --url, not both", err=True)
        sys.exit(1)

    output_dir = Path(output)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        if url:
            print("[1/4] Downloading from YouTube...")
            with tempfile.TemporaryDirectory() as temp_dir:
                audio_path = download_youtube_audio(url, temp_dir)
                if not audio_path:
                    print("Failed to download audio from YouTube")
                    sys.exit(1)

                if verbose:
                    print(f"      Downloaded: {audio_path.name}")

                zip_path = process_audio(audio_path, output_dir, title, artist, verbose)
        else:
            audio_path = Path(input_path)
            if not audio_path.exists():
                print(f"Error: File not found: {input_path}", file=sys.stderr)
                sys.exit(1)

            print(f"[1/4] Loading: {audio_path.name}")
            zip_path = process_audio(audio_path, output_dir, title, artist, verbose)

        print(f"\nDone! Created: {zip_path}")
        print(f"Extract to StepMania/Songs folder and refresh (F5) to play")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if verbose:
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
