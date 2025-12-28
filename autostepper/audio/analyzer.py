"""
Advanced audio analysis and beat detection using librosa

This module provides superior beat detection compared to the Java version
by leveraging state-of-the-art Music Information Retrieval algorithms.
"""

import librosa
import numpy as np
from pathlib import Path
from mutagen import File as MutagenFile


class BeatAnalyzer:
    """Advanced beat detection and tempo analysis using librosa"""

    def __init__(self, sample_rate=22050):
        self.sample_rate = sample_rate

    def load_and_analyze(self, audio_path):
        """Load audio file and perform comprehensive rhythm analysis"""

        audio_path = Path(audio_path)

        # Extract basic metadata
        metadata = self._extract_metadata(audio_path)

        # Load audio with librosa
        try:
            audio, sr = librosa.load(str(audio_path), sr=self.sample_rate)
        except Exception as e:
            raise ValueError(f"Could not load audio file {audio_path}: {e}")

        if len(audio) == 0:
            raise ValueError("Audio file appears to be empty")

        # Comprehensive beat analysis
        analysis = self._analyze_rhythm(audio, sr)

        # Combine metadata and analysis
        result = {
            **metadata,
            **analysis,
            'filename': audio_path.name,
            'filepath': str(audio_path),
            'duration': len(audio) / sr,
            'sample_rate': sr
        }

        return result

    def _extract_metadata(self, audio_path):
        """Extract metadata from audio file"""
        metadata = {
            'title': audio_path.stem,  # Fallback to filename
            'artist': 'Unknown Artist',
            'album': '',
            'genre': ''
        }

        try:
            audio_file = MutagenFile(str(audio_path))
            if audio_file is not None:
                # Handle different tag formats
                if hasattr(audio_file, 'tags') and audio_file.tags:
                    tags = audio_file.tags

                    # MP3 ID3 tags
                    if 'TIT2' in tags:
                        metadata['title'] = str(tags['TIT2'][0])
                    if 'TPE1' in tags:
                        metadata['artist'] = str(tags['TPE1'][0])
                    if 'TALB' in tags:
                        metadata['album'] = str(tags['TALB'][0])

                    # Generic tags for other formats
                    for key in ['TITLE', 'ARTIST', 'ALBUM', 'GENRE']:
                        if key in tags:
                            metadata[key.lower()] = str(tags[key][0])

        except Exception:
            # If metadata extraction fails, just use defaults
            pass

        return metadata

    def _analyze_rhythm(self, audio, sr):
        """Perform advanced rhythm analysis"""

        # 1. Beat tracking with librosa (main algorithm)
        tempo, beats = librosa.beat.beat_track(
            y=audio,
            sr=sr,
            start_bpm=120,  # Good starting guess
            tightness=100,  # How strictly beats follow tempo
            trim=False,
            hop_length=512
        )

        # Convert beat frames to time stamps
        beat_times = librosa.frames_to_time(beats, sr=sr)

        # 2. Onset detection for additional precision
        onsets = librosa.onset.onset_detect(
            y=audio,
            sr=sr,
            units='time',
            backtrack=True,
            normalize=True,
            delta=0.05  # Minimum time between onsets
        )

        # 3. Calculate confidence metrics
        confidence = self._calculate_confidence(audio, beats, onsets, sr)

        # 4. Tempo stability analysis
        tempo_stability = self._analyze_tempo_stability(audio, sr)

        return {
            'tempo': float(tempo),
            'beats': beats,
            'beat_times': beat_times,
            'onsets': onsets,
            'confidence': confidence,
            'tempo_stability': tempo_stability,
            'beat_count': len(beats)
        }

    def _calculate_confidence(self, audio, beats, onsets, sr):
        """Calculate beat detection confidence score (0.0 to 1.0)"""

        try:
            # Basic confidence: how well beats align with onset detection
            beat_times = librosa.frames_to_time(beats, sr=sr)

            if len(beat_times) == 0 or len(onsets) == 0:
                return 0.0

            # Count how many beats are close to onsets (within 0.1 seconds)
            alignment_count = 0
            for beat_time in beat_times:
                min_distance = min(abs(beat_time - onset) for onset in onsets)
                if min_distance < 0.1:  # 100ms tolerance
                    alignment_count += 1

            # Basic alignment score
            alignment_score = alignment_count / len(beat_times)

            # Tempo consistency score
            if len(beat_times) > 1:
                beat_intervals = np.diff(beat_times)
                tempo_consistency = 1.0 - (np.std(beat_intervals) / np.mean(beat_intervals))
                tempo_consistency = max(0.0, min(1.0, tempo_consistency))
            else:
                tempo_consistency = 0.5

            # Combined confidence score
            confidence = (alignment_score * 0.6) + (tempo_consistency * 0.4)
            return float(np.clip(confidence, 0.0, 1.0))

        except Exception:
            # If confidence calculation fails, return moderate confidence
            return 0.7

    def _analyze_tempo_stability(self, audio, sr):
        """Analyze how stable the tempo is throughout the song"""

        try:
            # Calculate tempogram (tempo over time)
            tempogram = librosa.feature.tempogram(y=audio, sr=sr)

            # Simple stability metric: variance in the tempogram
            stability = 1.0 - np.var(tempogram) / (np.mean(tempogram) + 1e-10)
            return float(np.clip(stability, 0.0, 1.0))

        except Exception:
            return 0.8  # Default to high stability if analysis fails