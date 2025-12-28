"""
StepMania .sm file format exporter

Converts step chart data to the standard StepMania .sm format.
"""

import math
from pathlib import Path


class SMExporter:
    """Export step charts to StepMania .sm format"""

    def export_chart(self, chart_data, output_file):
        """Export complete step chart to .sm file"""

        output_file = Path(output_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        sm_content = self._generate_sm_content(chart_data)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(sm_content)

    def _generate_sm_content(self, chart):
        """Generate complete .sm file content"""

        metadata = chart['metadata']
        timing = chart['timing']
        difficulty = chart['difficulty']
        notes = chart['notes']

        # Header section
        header = f"""#TITLE:{metadata['title']};
#SUBTITLE:;
#ARTIST:{metadata['artist']};
#TITLETRANSLIT:;
#SUBTITLETRANSLIT:;
#ARTISTTRANSLIT:;
#CREDIT:AutoStepper MVP (Python) | Original: phr00t/AutoStepper;
#BANNER:;
#BACKGROUND:;
#LYRICSPATH:;
#CDTITLE:;
#MUSIC:{metadata['filename']};
#OFFSET:{timing['offset']:.3f};
#SAMPLESTART:15.000;
#SAMPLELENGTH:15.000;
#SELECTABLE:YES;
#BPMS:0.000={timing['bpm']:.3f};
#STOPS:;
#BGCHANGES:;
#KEYSOUNDS:;

"""

        # Notes section
        notes_section = f"""#NOTES:
     {difficulty['type']}:
     {metadata['credit']}:
     {difficulty['description']}:
     {difficulty['feet']}:
     {difficulty['radar']}:
{self._format_notes(notes, timing['bpm'])};

"""

        return header + notes_section

    def _format_notes(self, notes, bpm):
        """Convert step data to SM note format"""

        if not notes:
            return "0000\n,\n0000"

        # Calculate beats per measure (SM uses 4/4 time)
        beats_per_measure = 4

        # Convert times to beat positions
        beat_positions = []
        for note in notes:
            beat_position = (note['time'] / 60.0) * bpm
            beat_positions.append((beat_position, note))

        if not beat_positions:
            return "0000\n,\n0000"

        # Group notes by measures
        measures = self._group_by_measures(beat_positions, beats_per_measure)

        # Format each measure
        formatted_measures = []
        for measure in measures:
            formatted_measure = self._format_measure(measure, beats_per_measure)
            formatted_measures.append(formatted_measure)

        # Join measures with commas
        return ',\n'.join(formatted_measures)

    def _group_by_measures(self, beat_positions, beats_per_measure):
        """Group notes into measures"""

        if not beat_positions:
            return []

        measures = []
        current_measure = []
        current_measure_num = 0

        for beat_pos, note in beat_positions:
            measure_num = int(beat_pos // beats_per_measure)

            # Start new measure if needed
            if measure_num > current_measure_num:
                if current_measure:
                    measures.append(current_measure)
                current_measure = []
                current_measure_num = measure_num

            # Add note to current measure
            beat_in_measure = beat_pos % beats_per_measure
            current_measure.append((beat_in_measure, note))

        # Don't forget the last measure
        if current_measure:
            measures.append(current_measure)

        return measures

    def _format_measure(self, measure_notes, beats_per_measure):
        """Format a single measure of notes"""

        if not measure_notes:
            return "0000\n0000\n0000\n0000"

        # Determine subdivision (how many lines per measure)
        # Use at least 4 lines, but increase for dense sections
        min_subdivision = 4
        max_beat_precision = max(note[0] for note in measure_notes) if measure_notes else 0

        # Calculate required subdivision based on note density
        required_subdivision = max(min_subdivision, int(math.ceil(max_beat_precision + 1)))

        # Common SM subdivisions: 4, 8, 12, 16, 24, 32, 48
        sm_subdivisions = [4, 8, 12, 16, 24, 32, 48, 64, 96, 192]
        subdivision = min(sub for sub in sm_subdivisions if sub >= required_subdivision)

        # Create empty measure grid
        lines = ['0000'] * subdivision

        # Place notes in grid
        for beat_in_measure, note in measure_notes:
            line_index = int((beat_in_measure / beats_per_measure) * subdivision)
            line_index = min(line_index, subdivision - 1)  # Clamp to valid range

            # Handle different note types
            if note['type'] == 'tap' or note['type'] == 'jump':
                lines[line_index] = note['pattern']
            elif note['type'] == 'hold':
                lines[line_index] = note['pattern'].replace('1', '2')  # Hold start
                # Mark hold end (simplified - just mark a few lines later)
                end_line = min(line_index + 4, subdivision - 1)
                lines[end_line] = note['pattern'].replace('1', '3')  # Hold end

        return '\n'.join(lines)