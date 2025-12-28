#!/usr/bin/env python3
"""
AutoStepper MVP - Generate StepMania/ITGMania charts from audio files

Python conversion of the original Java AutoStepper with superior beat detection
using librosa and modern Music Information Retrieval techniques.

Original concept and Java implementation by phr00t:
https://github.com/phr00t/AutoStepper
"""

import click
import sys
from pathlib import Path
import traceback

from autostepper.audio.analyzer import BeatAnalyzer
from autostepper.stepgen.generator import StepGenerator
from autostepper.formats.stepmania_ssc import SSCExporter


def sanitize_filename(name: str) -> str:
    """Sanitize filename by trimming spaces and replacing invalid characters"""
    # Strip leading/trailing whitespace
    name = name.strip()
    # Replace problematic characters
    for char in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
        name = name.replace(char, '_')
    # Replace spaces with underscores
    name = name.replace(' ', '_')
    # Remove any double underscores
    while '__' in name:
        name = name.replace('__', '_')
    return name


@click.command()
@click.option('--input', '-i', required=True,
              help='Input audio file (MP3, WAV, FLAC, etc.)')
@click.option('--output', '-o', default='./output',
              help='Output directory for .ssc file')
@click.option('--title', help='Override song title')
@click.option('--artist', help='Override artist name')
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
def main(input, output, title, artist, verbose):
    """AutoStepper MVP: Generate StepMania/ITGMania charts from audio files using advanced beat detection"""

    input_path = Path(input)
    output_path = Path(output)

    if not input_path.exists():
        click.echo(f"Error: Input file '{input}' not found", err=True)
        sys.exit(1)

    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)

    if verbose:
        click.echo(f"Processing: {input_path.name}")
        click.echo(f"Output: {output_path}")

    try:
        # Step 1: Analyze audio for beats and tempo
        if verbose:
            click.echo("Analyzing audio and detecting beats...")

        analyzer = BeatAnalyzer()
        audio_data = analyzer.load_and_analyze(input_path)

        if verbose:
            tempo = audio_data['tempo']
            beat_count = len(audio_data['beats'])
            confidence = audio_data.get('confidence', 0.0)
            click.echo(f"   Detected BPM: {tempo:.1f}")
            click.echo(f"   Found {beat_count} beats")
            click.echo(f"   Confidence: {confidence:.2f}")

        # Step 2: Generate step patterns for all difficulties
        if verbose:
            click.echo("Generating step patterns for all difficulties...")

        charts = StepGenerator.generate_all_difficulties(
            audio_data,
            title_override=title,
            artist_override=artist
        )

        if verbose:
            for chart in charts:
                diff_name = chart['difficulty']['description']
                step_count = len(chart['notes'])
                click.echo(f"   {diff_name.capitalize()}: {step_count} steps")

        # Step 3: Export to SSC format (all difficulties in one file)
        safe_filename = sanitize_filename(input_path.stem)
        output_file = output_path / f"{safe_filename}.ssc"

        if verbose:
            click.echo(f"Exporting to {output_file.name}...")

        exporter = SSCExporter()
        exporter.export_charts(charts, output_file)

        click.echo(f"Successfully created: {output_file}")
        click.echo(f"BPM: {audio_data['tempo']:.1f} | Difficulties: {len(charts)}")

        total_steps = sum(len(chart['notes']) for chart in charts)
        click.echo(f"Total steps generated: {total_steps}")

    except Exception as e:
        click.echo(f"Error processing {input_path.name}: {str(e)}", err=True)
        if verbose:
            click.echo(traceback.format_exc(), err=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
