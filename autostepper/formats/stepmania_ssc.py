"""
StepMania .ssc file format exporter

Exports step charts to the modern .ssc format used by ITGMania and StepMania 5.
Supports multiple difficulties in a single file.
"""

import math
from pathlib import Path
from typing import List, Dict, Any


class SSCExporter:
    """Export step charts to StepMania .ssc format with multi-difficulty support"""

    def export_charts(self, charts: List[Dict[str, Any]], output_file):
        """
        Export multiple difficulty charts to a single .ssc file

        Args:
            charts: List of chart data dictionaries (one per difficulty)
            output_file: Path to output .ssc file
        """
        output_file = Path(output_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        ssc_content = self._generate_ssc_content(charts)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(ssc_content)

    def _generate_ssc_content(self, charts: List[Dict[str, Any]]) -> str:
        """Generate complete .ssc file content with all difficulties"""

        if not charts:
            raise ValueError("At least one chart is required")

        # Use first chart for global metadata
        first_chart = charts[0]
        metadata = first_chart['metadata']
        timing = first_chart['timing']

        # Header section (global song metadata)
        header = f"""#VERSION:0.83;
#TITLE:{metadata['title']};
#SUBTITLE:;
#ARTIST:{metadata['artist']};
#TITLETRANSLIT:;
#SUBTITLETRANSLIT:;
#ARTISTTRANSLIT:;
#GENRE:;
#ORIGIN:;
#CREDIT:AutoStepper MVP (Python) | Original: phr00t/AutoStepper;
#BANNER:banner.png;
#BACKGROUND:;
#PREVIEWVID:;
#JACKET:;
#CDIMAGE:;
#DISCIMAGE:;
#LYRICSPATH:;
#CDTITLE:;
#MUSIC:{metadata['filename']};
#OFFSET:{timing['offset']:.6f};
#SAMPLESTART:15.000000;
#SAMPLELENGTH:15.000000;
#SELECTABLE:YES;
#BPMS:0.000={timing['bpm']:.6f};
#STOPS:;
#DELAYS:;
#WARPS:;
#TIMESIGNATURES:0.000=4=4;
#TICKCOUNTS:0.000=4;
#COMBOS:0.000=1;
#SPEEDS:0.000=1.000=0.000=0;
#SCROLLS:0.000=1.000;
#FAKES:;
#LABELS:0.000=Song Start;
#BGCHANGES:;
#KEYSOUNDS:;
#ATTACKS:;

"""

        # Generate note data sections for each difficulty
        notedata_sections = []
        for chart in charts:
            notedata = self._generate_notedata_section(chart)
            notedata_sections.append(notedata)

        return header + '\n'.join(notedata_sections)

    def _generate_notedata_section(self, chart: Dict[str, Any]) -> str:
        """Generate a #NOTEDATA section for a single difficulty"""

        difficulty = chart['difficulty']
        timing = chart['timing']
        notes = chart['notes']

        section = f"""//---------------{difficulty['description']}-----------------
#NOTEDATA:;
#CHARTNAME:;
#STEPSTYPE:{difficulty['type']};
#DESCRIPTION:{difficulty['description'].capitalize()};
#CHARTSTYLE:;
#DIFFICULTY:{self._get_ssc_difficulty(difficulty['description'])};
#METER:{difficulty['feet']};
#RADARVALUES:0,0,0,0,0;
#CREDIT:AutoStepper MVP;
#NOTES:
{self._format_notes(notes, timing['bpm'])};

"""
        return section

    def _get_ssc_difficulty(self, difficulty_name: str) -> str:
        """Convert difficulty name to SSC difficulty enum"""
        mapping = {
            'easy': 'Easy',
            'medium': 'Medium',
            'hard': 'Hard',
            'expert': 'Challenge'
        }
        return mapping.get(difficulty_name.lower(), 'Medium')

    def _format_notes(self, notes, bpm):
        """Convert step data to SSC note format"""

        if not notes:
            return "0000\n0000\n0000\n0000"

        # Calculate beats per measure (SSC uses 4/4 time)
        beats_per_measure = 4

        # Convert times to beat positions
        beat_positions = []
        for note in notes:
            beat_position = (note['time'] / 60.0) * bpm
            beat_positions.append((beat_position, note))

        if not beat_positions:
            return "0000\n0000\n0000\n0000"

        # Determine total measures needed
        max_beat = max(bp[0] for bp in beat_positions)
        total_measures = int(max_beat // beats_per_measure) + 1

        # Generate all measures (including empty ones)
        formatted_measures = []
        for measure_num in range(total_measures):
            measure_notes = [
                (bp[0] % beats_per_measure, bp[1])
                for bp in beat_positions
                if int(bp[0] // beats_per_measure) == measure_num
            ]
            formatted_measure = self._format_measure(measure_notes, beats_per_measure)
            formatted_measures.append(formatted_measure)

        # Join measures with commas
        return ',\n'.join(formatted_measures)

    def _format_measure(self, measure_notes, beats_per_measure):
        """Format a single measure of notes"""

        # Determine required subdivision based on note positions
        if not measure_notes:
            # Empty measure - use minimum subdivision
            return "0000\n0000\n0000\n0000"

        # Find the finest subdivision needed
        sm_subdivisions = [4, 8, 12, 16, 24, 32, 48, 64, 96, 192]

        # Check what subdivision is required for all notes
        required_subdivision = 4
        for beat_in_measure, note in measure_notes:
            fraction = beat_in_measure / beats_per_measure
            for sub in sm_subdivisions:
                line_pos = fraction * sub
                # Check if this subdivision can represent this beat position
                if abs(line_pos - round(line_pos)) < 0.001:
                    if sub > required_subdivision:
                        required_subdivision = sub
                    break

        subdivision = required_subdivision

        # Create empty measure grid
        lines = ['0000'] * subdivision

        # Place notes in grid
        for beat_in_measure, note in measure_notes:
            line_index = int(round((beat_in_measure / beats_per_measure) * subdivision))
            line_index = min(line_index, subdivision - 1)  # Clamp to valid range

            # Handle different note types
            if note['type'] == 'tap' or note['type'] == 'jump':
                # Merge with existing pattern (for multiple notes on same line)
                existing = lines[line_index]
                new_pattern = note['pattern']
                merged = ''.join(
                    str(max(int(a), int(b))) for a, b in zip(existing, new_pattern)
                )
                lines[line_index] = merged
            elif note['type'] == 'hold':
                # Hold start
                pattern = note['pattern'].replace('1', '2')
                existing = lines[line_index]
                merged = ''.join(
                    str(max(int(a), int(b))) for a, b in zip(existing, pattern)
                )
                lines[line_index] = merged

                # Calculate hold end position
                if 'hold_end_time' in note:
                    end_beat = (note['hold_end_time'] / 60.0) * (60.0 / note['time'] * (beat_in_measure + (int(note['time'] / 60.0 * (60.0 / beat_in_measure)) * beats_per_measure)))
                    # Simplified: just place end a few lines later
                    end_line = min(line_index + subdivision // 4, subdivision - 1)
                    end_pattern = note['pattern'].replace('1', '3')
                    existing_end = lines[end_line]
                    merged_end = ''.join(
                        str(max(int(a), int(b))) for a, b in zip(existing_end, end_pattern)
                    )
                    lines[end_line] = merged_end

        return '\n'.join(lines)
