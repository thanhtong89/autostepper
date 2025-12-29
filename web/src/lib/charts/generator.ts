/**
 * Step chart generator - JavaScript port from Python autostepper
 */

import type { ChartData, DifficultyChart, Note } from '$lib/storage/db';
import type { AnalysisResult } from '$lib/audio/analyzer';

interface DifficultyConfig {
  density: number;     // Percentage of beats to use (0-1)
  jumps: boolean;      // Allow jump notes
  holds: boolean;      // Allow hold notes
  minGap: number;      // Minimum seconds between notes
  feet: number;        // Difficulty rating
}

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  easy: {
    density: 0.4,
    jumps: false,
    holds: false,
    minGap: 0.5,
    feet: 2
  },
  medium: {
    density: 0.6,
    jumps: false,
    holds: true,
    minGap: 0.25,
    feet: 4
  },
  hard: {
    density: 0.8,
    jumps: true,
    holds: true,
    minGap: 0.125,
    feet: 6
  },
  expert: {
    density: 0.95,
    jumps: true,
    holds: true,
    minGap: 0.0625,
    feet: 8
  }
};

// Seeded random number generator for reproducible charts
class SeededRandom {
  private seed: number;

  constructor(seed: number = 42) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  reset(seed: number = 42): void {
    this.seed = seed;
  }
}

/**
 * Generate charts for all difficulty levels
 */
export function generateAllDifficulties(analysis: AnalysisResult): ChartData {
  const charts: ChartData = {
    version: 1,
    difficulties: {
      easy: generateChart(analysis, DIFFICULTIES.easy),
      medium: generateChart(analysis, DIFFICULTIES.medium),
      hard: generateChart(analysis, DIFFICULTIES.hard),
      expert: generateChart(analysis, DIFFICULTIES.expert)
    }
  };

  return charts;
}

/**
 * Generate a single difficulty chart
 */
function generateChart(analysis: AnalysisResult, config: DifficultyConfig): DifficultyChart {
  const { beats, bpm } = analysis;
  const rng = new SeededRandom(42);

  // Select beats based on density
  const selectedBeats = beats.filter(() => rng.next() < config.density);

  // Enforce minimum gap between notes
  const filteredBeats: number[] = [];
  let lastTime = -Infinity;

  for (const beat of selectedBeats) {
    if (beat - lastTime >= config.minGap) {
      filteredBeats.push(beat);
      lastTime = beat;
    }
  }

  // Generate notes
  const notes: Note[] = [];
  let lastLane = -1;

  for (let i = 0; i < filteredBeats.length; i++) {
    const time = filteredBeats[i];

    // Decide note type
    const isJump = config.jumps && rng.next() < 0.15;

    if (isJump) {
      // Jump note (two arrows)
      const lanes = pickTwoLanes(rng, lastLane);
      notes.push({
        time,
        type: 'jump',
        lanes
      });
      lastLane = lanes[1];
    } else {
      // Single note
      const lane = pickLane(rng, lastLane, config.feet <= 4);

      // Decide if hold
      const isHold = config.holds &&
                     rng.next() < 0.1 &&
                     i < filteredBeats.length - 1;

      if (isHold) {
        // Hold note
        const holdBeats = 2 + Math.floor(rng.next() * 2); // 2-3 beats
        const holdDuration = (60 / bpm) * holdBeats;
        notes.push({
          time,
          type: 'hold',
          lane,
          endTime: time + holdDuration
        });
      } else {
        // Tap note
        notes.push({
          time,
          type: 'tap',
          lane
        });
      }

      lastLane = lane;
    }
  }

  return {
    feet: config.feet,
    noteCount: notes.length,
    notes
  };
}

/**
 * Pick a single lane (0-3) for a note
 * Prefers adjacent lanes for easier patterns at lower difficulties
 */
function pickLane(rng: SeededRandom, lastLane: number, preferAdjacent: boolean): number {
  if (lastLane < 0 || !preferAdjacent) {
    return Math.floor(rng.next() * 4);
  }

  // 70% chance of adjacent lane at lower difficulties
  if (rng.next() < 0.7) {
    const direction = rng.next() < 0.5 ? -1 : 1;
    const newLane = lastLane + direction;
    if (newLane >= 0 && newLane <= 3) {
      return newLane;
    }
    // Wrap around
    return lastLane - direction;
  }

  return Math.floor(rng.next() * 4);
}

/**
 * Pick two lanes for a jump note
 */
function pickTwoLanes(rng: SeededRandom, lastLane: number): number[] {
  const all = [0, 1, 2, 3];

  // Pick first lane
  const firstIdx = Math.floor(rng.next() * 4);
  const first = all[firstIdx];
  all.splice(firstIdx, 1);

  // Pick second lane from remaining
  const secondIdx = Math.floor(rng.next() * 3);
  const second = all[secondIdx];

  return [first, second].sort((a, b) => a - b);
}

/**
 * Get lane name for display
 */
export function getLaneName(lane: number): string {
  const names = ['left', 'down', 'up', 'right'];
  return names[lane] || 'unknown';
}

/**
 * Get note pattern string (e.g., "1010" for left+up)
 */
export function getNotePattern(note: Note): string {
  const pattern = ['0', '0', '0', '0'];

  if (note.type === 'jump' && note.lanes) {
    for (const lane of note.lanes) {
      pattern[lane] = '1';
    }
  } else if (note.lane !== undefined) {
    pattern[note.lane] = note.type === 'hold' ? '2' : '1';
  }

  return pattern.join('');
}
