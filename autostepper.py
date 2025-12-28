#!/usr/bin/env python3
"""
AutoStepper MVP - Generate StepMania charts from audio files

Python conversion of the Java AutoStepper with superior beat detection
using librosa and modern Music Information Retrieval techniques.
"""

import click
import sys
from pathlib import Path
import traceback

from autostepper.audio.analyzer import BeatAnalyzer
from autostepper.stepgen.generator import StepGenerator
from autostepper.formats.stepmania import SMExporter


@click.command()
@click.option('--input', '-i', required=True,
              help='Input audio file (MP3, WAV, FLAC, etc.)')
@click.option('--output', '-o', default='./output',
              help='Output directory for .sm files')
@click.option('--difficulty', '-d', default='medium',
              type=click.Choice(['easy', 'medium', 'hard', 'expert']),
              help='Chart difficulty level')
@click.option('--title', help='Override song title')
@click.option('--artist', help='Override artist name')
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
def main(input, output, difficulty, title, artist, verbose):
    """AutoStepper MVP: Generate StepMania charts from audio files using advanced beat detection"""

    input_path = Path(input)
    output_path = Path(output)

    if not input_path.exists():
        click.echo(f"Error: Input file '{input}' not found", err=True)
        sys.exit(1)

    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)

    if verbose:
        click.echo(f"🎵 Processing: {input_path.name}")
        click.echo(f"📁 Output: {output_path}")
        click.echo(f"🎯 Difficulty: {difficulty}")

    try:
        # Step 1: Analyze audio for beats and tempo
        if verbose:
            click.echo("🔍 Analyzing audio and detecting beats...")

        analyzer = BeatAnalyzer()
        audio_data = analyzer.load_and_analyze(input_path)

        if verbose:
            tempo = audio_data['tempo']
            beat_count = len(audio_data['beats'])
            confidence = audio_data.get('confidence', 0.0)
            click.echo(f"   ✅ Detected BPM: {tempo:.1f}")
            click.echo(f"   ✅ Found {beat_count} beats")
            click.echo(f"   ✅ Confidence: {confidence:.2f}")

        # Step 2: Generate step patterns
        if verbose:
            click.echo("🚶 Generating step patterns...")

        generator = StepGenerator(difficulty=difficulty)
        step_chart = generator.generate_chart(
            audio_data,
            title_override=title,
            artist_override=artist
        )

        if verbose:
            step_count = len(step_chart['notes'])
            click.echo(f"   ✅ Generated {step_count} steps")

        # Step 3: Export to StepMania format
        safe_filename = input_path.stem.replace(" ", "_").replace("/", "_").replace("\\", "_")
        output_file = output_path / f"{safe_filename}_{difficulty}.sm"

        if verbose:
            click.echo(f"💾 Exporting to {output_file.name}...")

        exporter = SMExporter()
        exporter.export_chart(step_chart, output_file)

        click.echo(f"🎉 Successfully created: {output_file}")
        click.echo(f"🎯 BPM: {audio_data['tempo']:.1f} | Steps: {len(step_chart['notes'])} | Difficulty: {difficulty.title()}")

    except Exception as e:
        click.echo(f"❌ Error processing {input_path.name}: {str(e)}", err=True)
        if verbose:
            click.echo(traceback.format_exc(), err=True)
        sys.exit(1)


if __name__ == '__main__':
    main()