#!/usr/bin/env python3
"""
Test script for AutoStepper MVP

Creates a synthetic audio signal and tests the complete pipeline.
"""

import numpy as np
import soundfile as sf
import tempfile
import os
from pathlib import Path

from autostepper.audio.analyzer import BeatAnalyzer
from autostepper.stepgen.generator import StepGenerator
from autostepper.formats.stepmania import SMExporter


def create_test_audio(filename, duration=10, bpm=120, sample_rate=22050):
    """Create a synthetic audio file with a clear beat pattern"""

    # Calculate samples
    total_samples = int(duration * sample_rate)

    # Create a click track with beats
    beats_per_second = bpm / 60.0
    audio = np.zeros(total_samples)

    # Add beat clicks every beat
    for i in range(int(duration * beats_per_second)):
        beat_time = i / beats_per_second
        sample_index = int(beat_time * sample_rate)

        if sample_index < total_samples:
            # Create a short click (sine wave burst)
            click_duration = 0.05  # 50ms click
            click_samples = int(click_duration * sample_rate)

            for j in range(click_samples):
                if sample_index + j < total_samples:
                    # 440 Hz sine wave with envelope
                    t = j / sample_rate
                    envelope = np.exp(-t * 20)  # Exponential decay
                    audio[sample_index + j] += 0.5 * envelope * np.sin(2 * np.pi * 440 * t)

    # Add some background noise/music simulation
    # Simple low-frequency sine wave as "bass line"
    t = np.linspace(0, duration, total_samples)
    background = 0.1 * np.sin(2 * np.pi * 60 * t)  # 60 Hz bass
    audio += background

    # Normalize
    audio = audio / np.max(np.abs(audio))

    # Save as WAV file
    sf.write(filename, audio, sample_rate)
    print(f"✅ Created test audio: {filename}")
    print(f"   Duration: {duration}s, BPM: {bpm}, Sample Rate: {sample_rate}Hz")


def test_pipeline():
    """Test the complete AutoStepper pipeline"""

    print("🎵 AutoStepper MVP Test")
    print("=" * 40)

    # Create temporary audio file
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
        temp_audio_path = temp_file.name

    try:
        # Step 1: Create synthetic audio
        print("\n1. Creating synthetic test audio...")
        create_test_audio(temp_audio_path, duration=10, bpm=128)

        # Step 2: Analyze audio
        print("\n2. Analyzing audio for beats...")
        analyzer = BeatAnalyzer()
        audio_data = analyzer.load_and_analyze(temp_audio_path)

        print(f"   ✅ Detected BPM: {audio_data['tempo']:.1f}")
        print(f"   ✅ Found {len(audio_data['beats'])} beats")
        print(f"   ✅ Confidence: {audio_data['confidence']:.2f}")
        print(f"   ✅ Duration: {audio_data['duration']:.1f}s")

        # Step 3: Generate step patterns for different difficulties
        difficulties = ['easy', 'medium', 'hard', 'expert']

        for difficulty in difficulties:
            print(f"\n3.{difficulties.index(difficulty)+1}. Generating {difficulty} step chart...")

            generator = StepGenerator(difficulty=difficulty)
            step_chart = generator.generate_chart(
                audio_data,
                title_override=f"Test Song ({difficulty.title()})",
                artist_override="AutoStepper MVP"
            )

            print(f"     ✅ Generated {len(step_chart['notes'])} steps")
            print(f"     ✅ Step density: {step_chart['analysis_info']['step_density']:.2f}")

            # Step 4: Export to .sm file
            output_dir = Path("./test_output")
            output_dir.mkdir(exist_ok=True)
            output_file = output_dir / f"test_song_{difficulty}.sm"

            exporter = SMExporter()
            exporter.export_chart(step_chart, output_file)

            print(f"     ✅ Exported: {output_file}")

        print(f"\n🎉 Pipeline test completed successfully!")
        print(f"📁 Output files created in: ./test_output/")
        print(f"🎯 Test audio BPM: 128 (expected) vs {audio_data['tempo']:.1f} (detected)")

        # Display some sample step data
        sample_chart = step_chart  # Last generated chart (expert)
        print(f"\n📊 Sample Steps (Expert difficulty):")
        for i, step in enumerate(sample_chart['notes'][:5]):  # Show first 5 steps
            directions = ", ".join(step['directions'])
            print(f"   Step {i+1}: {step['time']:.2f}s - {step['type']} - {directions}")

        if len(sample_chart['notes']) > 5:
            print(f"   ... and {len(sample_chart['notes']) - 5} more steps")

        return True

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        # Cleanup
        if os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)


if __name__ == '__main__':
    success = test_pipeline()
    exit(0 if success else 1)