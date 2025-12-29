/**
 * StepMania SSC/SM format parser and serializer
 *
 * Supports both legacy .sm and modern .ssc formats for
 * full compatibility with StepMania/ITGMania
 */

import type { Note, DifficultyChart, ChartData } from '$lib/storage/db';

// SSC file metadata
export interface SSCMetadata {
  title: string;
  subtitle?: string;
  artist: string;
  genre?: string;
  credit?: string;
  banner?: string;
  background?: string;
  music: string;
  offset: number;
  sampleStart: number;
  sampleLength: number;
  bpm: number;
  // Additional timing data
  bpms?: string;
  stops?: string;
}

// Parsed SSC file
export interface SSCFile {
  metadata: SSCMetadata;
  charts: SSCChart[];
}

// Single chart in SSC file
export interface SSCChart {
  stepsType: string;
  description: string;
  difficulty: string;
  meter: number;
  notes: string;
}

// Lane index mapping
const LANE_ORDER = ['left', 'down', 'up', 'right'] as const;

/**
 * Parse SSC/SM file content into structured data
 */
export function parseSSC(content: string): SSCFile {
  const lines = content.split('\n');
  const metadata: Partial<SSCMetadata> = {};
  const charts: SSCChart[] = [];

  let currentChart: Partial<SSCChart> | null = null;
  let inNotes = false;
  let notesBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip comments and empty lines
    if (line.startsWith('//') || line === '') continue;

    // Check for tag
    const tagMatch = line.match(/^#([A-Z]+):(.*)$/);
    if (tagMatch) {
      const [, tag, value] = tagMatch;
      const cleanValue = value.replace(/;$/, '').trim();

      switch (tag) {
        case 'TITLE':
          metadata.title = cleanValue;
          break;
        case 'SUBTITLE':
          metadata.subtitle = cleanValue;
          break;
        case 'ARTIST':
          metadata.artist = cleanValue;
          break;
        case 'GENRE':
          metadata.genre = cleanValue;
          break;
        case 'CREDIT':
          metadata.credit = cleanValue;
          break;
        case 'BANNER':
          metadata.banner = cleanValue;
          break;
        case 'BACKGROUND':
          metadata.background = cleanValue;
          break;
        case 'MUSIC':
          metadata.music = cleanValue;
          break;
        case 'OFFSET':
          metadata.offset = parseFloat(cleanValue) || 0;
          break;
        case 'SAMPLESTART':
          metadata.sampleStart = parseFloat(cleanValue) || 0;
          break;
        case 'SAMPLELENGTH':
          metadata.sampleLength = parseFloat(cleanValue) || 15;
          break;
        case 'BPMS':
          metadata.bpms = cleanValue;
          // Parse first BPM value
          const bpmMatch = cleanValue.match(/[\d.]+=([\d.]+)/);
          if (bpmMatch) {
            metadata.bpm = parseFloat(bpmMatch[1]);
          }
          break;
        case 'STOPS':
          metadata.stops = cleanValue;
          break;
        case 'NOTEDATA':
          // SSC format - new chart section
          currentChart = {};
          break;
        case 'STEPSTYPE':
          if (currentChart) currentChart.stepsType = cleanValue;
          break;
        case 'DESCRIPTION':
          if (currentChart) currentChart.description = cleanValue;
          break;
        case 'DIFFICULTY':
          if (currentChart) currentChart.difficulty = cleanValue;
          break;
        case 'METER':
          if (currentChart) currentChart.meter = parseInt(cleanValue) || 1;
          break;
        case 'NOTES':
          if (currentChart) {
            inNotes = true;
            notesBuffer = cleanValue;
            // Check if notes end on same line
            if (cleanValue.endsWith(';')) {
              currentChart.notes = cleanValue.replace(/;$/, '');
              charts.push(currentChart as SSCChart);
              currentChart = null;
              inNotes = false;
              notesBuffer = '';
            }
          } else {
            // Legacy SM format - NOTES contains all chart info
            // #NOTES:type:description:difficulty:meter:grooveradar:notes;
            inNotes = true;
            notesBuffer = value;
            currentChart = {};
          }
          break;
      }
    } else if (inNotes) {
      // Accumulate notes content
      notesBuffer += '\n' + line;

      if (line.endsWith(';')) {
        // Notes section ended
        const notesContent = notesBuffer.replace(/;$/, '').trim();

        if (currentChart) {
          // Check if this is SM format (notes contain metadata)
          const parts = notesContent.split(':');
          if (parts.length >= 6 && !currentChart.stepsType) {
            // SM format: type:description:difficulty:meter:grooveradar:notes
            currentChart.stepsType = parts[0].trim();
            currentChart.description = parts[1].trim();
            currentChart.difficulty = parts[2].trim();
            currentChart.meter = parseInt(parts[3].trim()) || 1;
            currentChart.notes = parts.slice(5).join(':').trim();
          } else {
            currentChart.notes = notesContent;
          }

          if (currentChart.stepsType && currentChart.notes) {
            charts.push(currentChart as SSCChart);
          }
        }

        currentChart = null;
        inNotes = false;
        notesBuffer = '';
      }
    }
  }

  return {
    metadata: {
      title: metadata.title || 'Unknown',
      artist: metadata.artist || 'Unknown',
      music: metadata.music || 'song.mp3',
      offset: metadata.offset || 0,
      sampleStart: metadata.sampleStart || 15,
      sampleLength: metadata.sampleLength || 15,
      bpm: metadata.bpm || 120,
      ...metadata
    },
    charts
  };
}

/**
 * Convert SSC notes string to our internal Note format
 */
export function parseSSCNotes(notesString: string, bpm: number, offset: number = 0): Note[] {
  const notes: Note[] = [];
  const measures = notesString.split(',');

  const beatsPerMeasure = 4;
  const secondsPerBeat = 60 / bpm;

  // Track holds in progress
  const activeHolds: Map<number, { startTime: number }> = new Map();

  let measureNum = 0;
  for (const measureRaw of measures) {
    const measure = measureRaw.trim();
    if (!measure) {
      measureNum++;
      continue;
    }

    // Split into rows (each row is one timing position)
    const rows = measure.split('\n').map(r => r.trim()).filter(r => r && !r.startsWith('//'));
    const rowsPerMeasure = rows.length;

    if (rowsPerMeasure === 0) {
      measureNum++;
      continue;
    }

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (row.length < 4) continue;

      // Calculate time for this row
      const beatInMeasure = (rowIdx / rowsPerMeasure) * beatsPerMeasure;
      const totalBeats = measureNum * beatsPerMeasure + beatInMeasure;
      const time = totalBeats * secondsPerBeat - offset;

      if (time < 0) continue;

      // Parse each column (lane)
      const taps: number[] = [];
      const holdStarts: number[] = [];
      const holdEnds: number[] = [];

      for (let lane = 0; lane < 4 && lane < row.length; lane++) {
        const noteType = row[lane];

        switch (noteType) {
          case '1': // Tap
            taps.push(lane);
            break;
          case '2': // Hold head
          case '4': // Roll head
            holdStarts.push(lane);
            activeHolds.set(lane, { startTime: time });
            break;
          case '3': // Hold/roll tail
            const holdData = activeHolds.get(lane);
            if (holdData) {
              holdEnds.push(lane);
            }
            break;
          case 'M': // Mine (ignore for now)
          case 'L': // Lift (ignore for now)
          case 'F': // Fake (ignore for now)
          case '0': // Empty
          default:
            break;
        }
      }

      // Create tap notes
      if (taps.length === 1) {
        notes.push({ time, type: 'tap', lane: taps[0] });
      } else if (taps.length >= 2) {
        // Jump note
        notes.push({ time, type: 'jump', lanes: taps.slice(0, 2).sort((a, b) => a - b) });
        // If more than 2 taps, add additional as separate notes
        for (let i = 2; i < taps.length; i++) {
          notes.push({ time, type: 'tap', lane: taps[i] });
        }
      }

      // Create hold notes
      for (const lane of holdStarts) {
        // We'll update the endTime when we find the tail
        notes.push({ time, type: 'hold', lane, endTime: time + 1 });
      }

      // Update hold end times
      for (const lane of holdEnds) {
        const holdData = activeHolds.get(lane);
        if (holdData) {
          // Find the hold note and update its end time
          for (let i = notes.length - 1; i >= 0; i--) {
            if (notes[i].type === 'hold' && notes[i].lane === lane && notes[i].time === holdData.startTime) {
              notes[i].endTime = time;
              break;
            }
          }
          activeHolds.delete(lane);
        }
      }
    }

    measureNum++;
  }

  // Sort notes by time
  notes.sort((a, b) => a.time - b.time);

  return notes;
}

/**
 * Convert our internal chart format to SSC format
 */
export function serializeToSSC(
  metadata: SSCMetadata,
  charts: { difficulty: string; chart: DifficultyChart }[]
): string {
  const lines: string[] = [];

  // Header
  lines.push('#VERSION:0.83;');
  lines.push(`#TITLE:${metadata.title};`);
  lines.push(`#SUBTITLE:${metadata.subtitle || ''};`);
  lines.push(`#ARTIST:${metadata.artist};`);
  lines.push('#TITLETRANSLIT:;');
  lines.push('#SUBTITLETRANSLIT:;');
  lines.push('#ARTISTTRANSLIT:;');
  lines.push(`#GENRE:${metadata.genre || ''};`);
  lines.push('#ORIGIN:;');
  lines.push(`#CREDIT:${metadata.credit || 'AutoStepper Web'};`);
  lines.push(`#BANNER:${metadata.banner || 'banner.png'};`);
  lines.push(`#BACKGROUND:${metadata.background || ''};`);
  lines.push('#PREVIEWVID:;');
  lines.push('#JACKET:;');
  lines.push('#CDIMAGE:;');
  lines.push('#DISCIMAGE:;');
  lines.push('#LYRICSPATH:;');
  lines.push('#CDTITLE:;');
  lines.push(`#MUSIC:${metadata.music};`);
  lines.push(`#OFFSET:${metadata.offset.toFixed(6)};`);
  lines.push(`#SAMPLESTART:${metadata.sampleStart.toFixed(6)};`);
  lines.push(`#SAMPLELENGTH:${metadata.sampleLength.toFixed(6)};`);
  lines.push('#SELECTABLE:YES;');
  lines.push(`#BPMS:0.000=${metadata.bpm.toFixed(6)};`);
  lines.push('#STOPS:;');
  lines.push('#DELAYS:;');
  lines.push('#WARPS:;');
  lines.push('#TIMESIGNATURES:0.000=4=4;');
  lines.push('#TICKCOUNTS:0.000=4;');
  lines.push('#COMBOS:0.000=1;');
  lines.push('#SPEEDS:0.000=1.000=0.000=0;');
  lines.push('#SCROLLS:0.000=1.000;');
  lines.push('#FAKES:;');
  lines.push('#LABELS:0.000=Song Start;');
  lines.push('#BGCHANGES:;');
  lines.push('#KEYSOUNDS:;');
  lines.push('#ATTACKS:;');
  lines.push('');

  // Charts
  for (const { difficulty, chart } of charts) {
    lines.push(`//---------------${difficulty}-----------------`);
    lines.push('#NOTEDATA:;');
    lines.push('#CHARTNAME:;');
    lines.push('#STEPSTYPE:dance-single;');
    lines.push(`#DESCRIPTION:${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)};`);
    lines.push('#CHARTSTYLE:;');
    lines.push(`#DIFFICULTY:${getSSCDifficulty(difficulty)};`);
    lines.push(`#METER:${chart.feet};`);
    lines.push('#RADARVALUES:0,0,0,0,0;');
    lines.push('#CREDIT:AutoStepper Web;');
    lines.push('#NOTES:');
    lines.push(formatNotesToSSC(chart.notes, metadata.bpm, metadata.offset));
    lines.push(';');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Convert difficulty name to SSC difficulty enum
 */
function getSSCDifficulty(name: string): string {
  const mapping: Record<string, string> = {
    'easy': 'Easy',
    'medium': 'Medium',
    'hard': 'Hard',
    'expert': 'Challenge'
  };
  return mapping[name.toLowerCase()] || 'Medium';
}

/**
 * Format notes array to SSC notes string
 */
function formatNotesToSSC(notes: Note[], bpm: number, offset: number = 0): string {
  if (notes.length === 0) {
    return '0000\n0000\n0000\n0000';
  }

  const beatsPerMeasure = 4;
  const secondsPerBeat = 60 / bpm;

  // Calculate total measures needed
  const maxTime = Math.max(...notes.map(n => n.type === 'hold' && n.endTime ? n.endTime : n.time));
  const maxBeat = (maxTime + offset) / secondsPerBeat;
  const totalMeasures = Math.ceil(maxBeat / beatsPerMeasure) + 1;

  // Determine subdivision needed (find finest required)
  const findSubdivision = (beat: number): number => {
    const subdivisions = [4, 8, 12, 16, 24, 32, 48, 64, 96, 192];
    for (const sub of subdivisions) {
      const pos = (beat % beatsPerMeasure) / beatsPerMeasure * sub;
      if (Math.abs(pos - Math.round(pos)) < 0.001) {
        return sub;
      }
    }
    return 192;
  };

  // Group notes by measure
  const measureNotes: Map<number, { beat: number; note: Note }[]> = new Map();

  for (const note of notes) {
    const beat = (note.time + offset) / secondsPerBeat;
    const measureNum = Math.floor(beat / beatsPerMeasure);

    if (!measureNotes.has(measureNum)) {
      measureNotes.set(measureNum, []);
    }
    measureNotes.get(measureNum)!.push({ beat: beat % beatsPerMeasure, note });

    // Add hold end markers
    if (note.type === 'hold' && note.endTime !== undefined && note.lane !== undefined) {
      const endBeat = (note.endTime + offset) / secondsPerBeat;
      const endMeasure = Math.floor(endBeat / beatsPerMeasure);

      if (!measureNotes.has(endMeasure)) {
        measureNotes.set(endMeasure, []);
      }
      measureNotes.get(endMeasure)!.push({
        beat: endBeat % beatsPerMeasure,
        note: { time: note.endTime, type: 'tap', lane: note.lane, _isHoldEnd: true } as Note & { _isHoldEnd?: boolean }
      });
    }
  }

  // Format each measure
  const formattedMeasures: string[] = [];

  for (let m = 0; m < totalMeasures; m++) {
    const notesInMeasure = measureNotes.get(m) || [];

    if (notesInMeasure.length === 0) {
      formattedMeasures.push('0000\n0000\n0000\n0000');
      continue;
    }

    // Find subdivision needed for this measure
    let subdivision = 4;
    for (const { beat } of notesInMeasure) {
      const sub = findSubdivision(beat);
      if (sub > subdivision) subdivision = sub;
    }

    // Create measure grid
    const rows: string[] = [];
    for (let r = 0; r < subdivision; r++) {
      rows.push('0000');
    }

    // Place notes in grid
    for (const { beat, note } of notesInMeasure) {
      const rowIdx = Math.round((beat / beatsPerMeasure) * subdivision);
      if (rowIdx >= subdivision) continue;

      const rowChars = rows[rowIdx].split('');

      if (note.type === 'jump' && note.lanes) {
        for (const lane of note.lanes) {
          if (lane >= 0 && lane < 4) {
            rowChars[lane] = '1';
          }
        }
      } else if (note.lane !== undefined && note.lane >= 0 && note.lane < 4) {
        if ((note as Note & { _isHoldEnd?: boolean })._isHoldEnd) {
          rowChars[note.lane] = '3';
        } else if (note.type === 'hold') {
          rowChars[note.lane] = '2';
        } else {
          rowChars[note.lane] = '1';
        }
      }

      rows[rowIdx] = rowChars.join('');
    }

    formattedMeasures.push(rows.join('\n'));
  }

  return formattedMeasures.join('\n,\n');
}

/**
 * Convert SSC file to our internal ChartData format
 */
export function sscToChartData(ssc: SSCFile): ChartData {
  const difficulties: ChartData['difficulties'] = {
    easy: { feet: 2, noteCount: 0, notes: [] },
    medium: { feet: 4, noteCount: 0, notes: [] },
    hard: { feet: 6, noteCount: 0, notes: [] },
    expert: { feet: 8, noteCount: 0, notes: [] }
  };

  for (const chart of ssc.charts) {
    // Only process dance-single charts
    if (chart.stepsType !== 'dance-single') continue;

    const notes = parseSSCNotes(chart.notes, ssc.metadata.bpm, ssc.metadata.offset);
    const diffName = mapSSCDifficulty(chart.difficulty);

    if (diffName && diffName in difficulties) {
      difficulties[diffName as keyof typeof difficulties] = {
        feet: chart.meter,
        noteCount: notes.length,
        notes
      };
    }
  }

  return { version: 1, difficulties };
}

/**
 * Map SSC difficulty name to our difficulty names
 */
function mapSSCDifficulty(sscDiff: string): string | null {
  const mapping: Record<string, string> = {
    'Beginner': 'easy',
    'Easy': 'easy',
    'Medium': 'medium',
    'Hard': 'hard',
    'Challenge': 'expert',
    'Expert': 'expert',
    'Edit': 'expert'
  };
  return mapping[sscDiff] || null;
}

/**
 * Convert our ChartData to SSC format
 */
export function chartDataToSSC(chartData: ChartData, metadata: SSCMetadata): string {
  const charts: { difficulty: string; chart: DifficultyChart }[] = [];

  for (const [diff, chart] of Object.entries(chartData.difficulties)) {
    if (chart.notes.length > 0) {
      charts.push({ difficulty: diff, chart });
    }
  }

  return serializeToSSC(metadata, charts);
}
