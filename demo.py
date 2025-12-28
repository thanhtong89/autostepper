#!/usr/bin/env python3
"""
Quick demo script showing AutoStepper MVP usage
"""

import numpy as np
import soundfile as sf
import tempfile
import os

# Create a longer, more realistic test song
def create_demo_song():
    """Create a 30-second demo song with varying tempo"""

    duration = 30  # 30 seconds
    sample_rate = 22050
    bpm = 140

    total_samples = int(duration * sample_rate)
    audio = np.zeros(total_samples)

    beats_per_second = bpm / 60.0

    # Create kick drum pattern (every beat)
    for i in range(int(duration * beats_per_second)):
        beat_time = i / beats_per_second
        sample_index = int(beat_time * sample_rate)

        if sample_index < total_samples:
            # Kick drum (low frequency thump)
            kick_duration = 0.1
            kick_samples = int(kick_duration * sample_rate)

            for j in range(kick_samples):
                if sample_index + j < total_samples:
                    t = j / sample_rate
                    envelope = np.exp(-t * 15)
                    audio[sample_index + j] += 0.6 * envelope * np.sin(2 * np.pi * 60 * t)

    # Add snare on off-beats (every other beat)
    for i in range(1, int(duration * beats_per_second), 2):
        beat_time = i / beats_per_second
        sample_index = int(beat_time * sample_rate)

        if sample_index < total_samples:
            # Snare (high frequency burst)
            snare_duration = 0.05
            snare_samples = int(snare_duration * sample_rate)

            for j in range(snare_samples):
                if sample_index + j < total_samples:
                    t = j / sample_rate
                    envelope = np.exp(-t * 30)
                    # White noise burst for snare
                    noise = np.random.normal(0, 0.3) * envelope
                    audio[sample_index + j] += noise

    # Add melody line
    t = np.linspace(0, duration, total_samples)
    melody_freq = 220  # A note
    melody = 0.2 * np.sin(2 * np.pi * melody_freq * t) * np.sin(2 * np.pi * 0.5 * t)
    audio += melody

    # Add bass line
    bass = 0.3 * np.sin(2 * np.pi * 55 * t)  # A1 bass note
    audio += bass

    # Normalize
    audio = audio / np.max(np.abs(audio)) * 0.8

    return audio, sample_rate

if __name__ == '__main__':
    print("🎵 AutoStepper MVP Demo")
    print("=" * 30)

    # Create demo song
    print("Creating 30-second demo song...")
    audio, sr = create_demo_song()

    # Save to temporary file
    demo_file = "demo_song.wav"
    sf.write(demo_file, audio, sr)
    print(f"✅ Saved demo song: {demo_file}")

    print("\nNow you can run:")
    print(f"source venv/bin/activate")
    print(f"python autostepper.py -i {demo_file} -d medium -v")
    print("\nOr try all difficulties:")
    for diff in ['easy', 'medium', 'hard', 'expert']:
        print(f"python autostepper.py -i {demo_file} -d {diff} -o ./charts/ -v")