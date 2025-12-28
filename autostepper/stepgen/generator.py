"""
Step chart generation logic

Converts beat analysis into StepMania step patterns with difficulty scaling.
"""

import random
import numpy as np
from typing import List, Dict, Any


class StepGenerator:
    """Generate StepMania step charts from beat analysis"""

    # Step directions for dance-single (4-panel)
    DIRECTIONS = ['Left', 'Down', 'Up', 'Right']
    DIRECTION_CODES = {'Left': '1000', 'Down': '0100', 'Up': '0010', 'Right': '0001'}

    # Difficulty settings
    DIFFICULTY_CONFIGS = {
        'easy': {
            'step_density': 0.4,      # Use 40% of beats
            'jumps_enabled': False,    # No simultaneous steps
            'holds_enabled': False,    # No hold notes
            'complexity': 1.0,         # Simple patterns
            'min_gap': 0.5            # Minimum time between steps (seconds)
        },
        'medium': {
            'step_density': 0.6,
            'jumps_enabled': False,
            'holds_enabled': True,
            'complexity': 1.5,
            'min_gap': 0.25
        },
        'hard': {
            'step_density': 0.8,
            'jumps_enabled': True,
            'holds_enabled': True,
            'complexity': 2.0,
            'min_gap': 0.125
        },
        'expert': {
            'step_density': 0.95,
            'jumps_enabled': True,
            'holds_enabled': True,
            'complexity': 3.0,
            'min_gap': 0.0625
        }
    }

    def __init__(self, difficulty='medium'):
        self.difficulty = difficulty
        self.config = self.DIFFICULTY_CONFIGS.get(difficulty, self.DIFFICULTY_CONFIGS['medium'])
        self.last_step_direction = None
        random.seed(42)  # For reproducible patterns

    def generate_chart(self, audio_data, title_override=None, artist_override=None):
        """Generate complete step chart from audio analysis"""

        beat_times = audio_data['beat_times']
        tempo = audio_data['tempo']

        # Generate step sequence
        steps = self._generate_steps(beat_times, tempo)

        # Create chart data structure
        chart = {
            'metadata': {
                'title': title_override or audio_data.get('title', 'Unknown Title'),
                'artist': artist_override or audio_data.get('artist', 'Unknown Artist'),
                'album': audio_data.get('album', ''),
                'genre': audio_data.get('genre', ''),
                'filename': audio_data['filename'],
                'credit': 'AutoStepper MVP'
            },
            'timing': {
                'bpm': float(tempo),
                'offset': 0.0,  # Start immediately
                'duration': audio_data['duration']
            },
            'difficulty': {
                'type': 'dance-single',
                'description': self.difficulty,
                'feet': self._calculate_difficulty_rating(),
                'radar': '0,0,0,0,0'  # Placeholder radar values
            },
            'notes': steps,
            'analysis_info': {
                'beat_count': len(beat_times),
                'step_count': len(steps),
                'confidence': audio_data.get('confidence', 0.8),
                'step_density': len(steps) / len(beat_times) if beat_times.size > 0 else 0
            }
        }

        return chart

    def _generate_steps(self, beat_times, tempo):
        """Generate step patterns from beat timing"""

        if len(beat_times) == 0:
            return []

        # Filter beats based on difficulty density
        selected_beats = self._select_beats(beat_times, tempo)

        steps = []
        for i, beat_time in enumerate(selected_beats):
            step = self._generate_step_at_time(beat_time, i, tempo)
            if step:
                steps.append(step)

        # Add holds if enabled
        if self.config['holds_enabled']:
            steps = self._add_holds(steps, tempo)

        # Sort by time
        steps.sort(key=lambda s: s['time'])

        return steps

    def _select_beats(self, beat_times, tempo):
        """Select subset of beats based on difficulty settings"""

        if len(beat_times) == 0:
            return np.array([])

        density = self.config['step_density']
        min_gap = self.config['min_gap']

        # Start with all beats
        selected = []
        last_selected_time = -999

        for beat_time in beat_times:
            # Always include if we haven't selected anything yet
            if not selected:
                selected.append(beat_time)
                last_selected_time = beat_time
                continue

            # Check minimum gap
            time_since_last = beat_time - last_selected_time
            if time_since_last < min_gap:
                continue

            # Probabilistic selection based on density
            if random.random() < density:
                selected.append(beat_time)
                last_selected_time = beat_time

        return np.array(selected)

    def _generate_step_at_time(self, beat_time, step_index, tempo):
        """Generate step pattern at specific time"""

        # Determine step type based on difficulty and patterns
        is_jump = (self.config['jumps_enabled'] and
                  random.random() < 0.15 and  # 15% chance of jumps
                  step_index > 0)  # No jumps on first step

        if is_jump:
            return self._create_jump_step(beat_time)
        else:
            return self._create_single_step(beat_time)

    def _create_single_step(self, beat_time):
        """Create a single direction step"""

        # Choose direction with some pattern logic
        if self.last_step_direction is None:
            # First step - choose randomly
            direction = random.choice(self.DIRECTIONS)
        else:
            # Try to create interesting patterns
            available_directions = [d for d in self.DIRECTIONS if d != self.last_step_direction]

            # Bias towards alternating patterns for easier difficulties
            if self.difficulty == 'easy':
                # Prefer adjacent arrows for easier play
                if self.last_step_direction == 'Left':
                    direction = random.choice(['Down', 'Up'])
                elif self.last_step_direction == 'Right':
                    direction = random.choice(['Down', 'Up'])
                else:
                    direction = random.choice(['Left', 'Right'])
            else:
                direction = random.choice(available_directions)

        self.last_step_direction = direction

        return {
            'time': float(beat_time),
            'type': 'tap',
            'directions': [direction],
            'pattern': self.DIRECTION_CODES[direction]
        }

    def _create_jump_step(self, beat_time):
        """Create a jump (simultaneous) step"""

        # Select two directions for jump
        directions = random.sample(self.DIRECTIONS, 2)

        # Create pattern code
        pattern = '0000'
        for direction in directions:
            individual_pattern = self.DIRECTION_CODES[direction]
            pattern = ''.join(str(int(a) | int(b)) for a, b in zip(pattern, individual_pattern))

        return {
            'time': float(beat_time),
            'type': 'jump',
            'directions': directions,
            'pattern': pattern
        }

    def _add_holds(self, steps, tempo):
        """Add hold notes to step sequence"""

        if not steps:
            return steps

        # Calculate reasonable hold duration based on tempo
        beat_length = 60.0 / tempo  # Seconds per beat
        min_hold_duration = beat_length * 2  # At least 2 beats
        max_hold_duration = beat_length * 4  # At most 4 beats

        enhanced_steps = []
        for i, step in enumerate(steps):
            enhanced_steps.append(step)

            # Occasionally convert single steps to holds
            if (step['type'] == 'tap' and
                random.random() < 0.1 and  # 10% chance
                i < len(steps) - 2):  # Not near the end

                # Find next suitable end time
                current_time = step['time']
                hold_duration = random.uniform(min_hold_duration, max_hold_duration)
                end_time = current_time + hold_duration

                # Make sure hold doesn't interfere with upcoming steps
                next_step_time = steps[i + 1]['time'] if i + 1 < len(steps) else float('inf')
                if end_time < next_step_time - 0.5:  # 0.5 second buffer
                    step['type'] = 'hold'
                    step['hold_end_time'] = float(end_time)

        return enhanced_steps

    def _calculate_difficulty_rating(self):
        """Calculate numeric difficulty rating (1-10)"""
        ratings = {
            'easy': 2,
            'medium': 4,
            'hard': 6,
            'expert': 8
        }
        return ratings.get(self.difficulty, 4)

    @classmethod
    def generate_all_difficulties(cls, audio_data, title_override=None, artist_override=None,
                                   difficulties=None):
        """
        Generate charts for all difficulty levels

        Args:
            audio_data: Audio analysis data from BeatAnalyzer
            title_override: Optional title override
            artist_override: Optional artist override
            difficulties: List of difficulties to generate (default: all)

        Returns:
            List of chart data dictionaries, one per difficulty
        """
        if difficulties is None:
            difficulties = ['easy', 'medium', 'hard', 'expert']

        charts = []
        for difficulty in difficulties:
            generator = cls(difficulty=difficulty)
            chart = generator.generate_chart(
                audio_data,
                title_override=title_override,
                artist_override=artist_override
            )
            charts.append(chart)

        return charts