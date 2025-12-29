/**
 * Timing windows and scoring system
 * Based on ITGMania/StepMania timing
 */

export type Judgment = 'marvelous' | 'perfect' | 'great' | 'good' | 'miss';

// Hit windows in seconds (±)
export const HIT_WINDOWS: Record<Judgment, number> = {
  marvelous: 0.0225,  // ±22.5ms (Fantastic in ITG)
  perfect: 0.045,     // ±45ms (Excellent)
  great: 0.090,       // ±90ms (Great)
  good: 0.135,        // ±135ms (Decent)
  miss: 0.180         // Beyond this is miss
};

// Score values per judgment
const SCORE_VALUES: Record<Judgment, number> = {
  marvelous: 100,
  perfect: 98,
  great: 65,
  good: 25,
  miss: 0
};

// Judgment colors for display
export const JUDGMENT_COLORS: Record<Judgment, string> = {
  marvelous: '#22d3ee', // cyan
  perfect: '#facc15',   // yellow
  great: '#22c55e',     // green
  good: '#3b82f6',      // blue
  miss: '#ef4444'       // red
};

// Grade thresholds (percentage of max score)
export type Grade = 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D' | 'F';

const GRADE_THRESHOLDS: [number, Grade][] = [
  [1.00, 'AAA'],   // 100% (quad star in ITG)
  [0.99, 'AA'],    // 99%+
  [0.96, 'A'],     // 96%+
  [0.89, 'B'],     // 89%+
  [0.80, 'C'],     // 80%+
  [0.65, 'D'],     // 65%+
  [0, 'F']         // Below 65%
];

export interface GameScore {
  // Judgment counts
  judgments: Record<Judgment, number>;

  // Running totals
  score: number;
  maxPossibleScore: number;
  combo: number;
  maxCombo: number;

  // Calculated values
  accuracy: number;   // 0-1
  grade: Grade;

  // Note tracking
  notesHit: number;
  notesMissed: number;
  totalNotes: number;
}

/**
 * Create initial score state
 */
export function createGameScore(totalNotes: number): GameScore {
  return {
    judgments: {
      marvelous: 0,
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0
    },
    score: 0,
    maxPossibleScore: totalNotes * SCORE_VALUES.marvelous,
    combo: 0,
    maxCombo: 0,
    accuracy: 1,
    grade: 'AAA',
    notesHit: 0,
    notesMissed: 0,
    totalNotes
  };
}

/**
 * Judge a hit based on timing difference
 */
export function judgeHit(hitTime: number, noteTime: number): Judgment {
  const diff = Math.abs(hitTime - noteTime);

  if (diff <= HIT_WINDOWS.marvelous) return 'marvelous';
  if (diff <= HIT_WINDOWS.perfect) return 'perfect';
  if (diff <= HIT_WINDOWS.great) return 'great';
  if (diff <= HIT_WINDOWS.good) return 'good';
  return 'miss';
}

/**
 * Check if a hit time is within any valid window
 */
export function isValidHit(hitTime: number, noteTime: number): boolean {
  const diff = Math.abs(hitTime - noteTime);
  return diff <= HIT_WINDOWS.good;
}

/**
 * Record a judgment and update score
 */
export function recordJudgment(score: GameScore, judgment: Judgment): void {
  score.judgments[judgment]++;

  // Update score
  score.score += SCORE_VALUES[judgment];

  // Update combo
  if (judgment === 'miss') {
    score.combo = 0;
    score.notesMissed++;
  } else {
    score.combo++;
    score.notesHit++;
    if (score.combo > score.maxCombo) {
      score.maxCombo = score.combo;
    }
  }

  // Recalculate accuracy
  const totalJudged = score.notesHit + score.notesMissed;
  if (totalJudged > 0) {
    score.accuracy = score.score / (totalJudged * SCORE_VALUES.marvelous);
  }

  // Update grade
  score.grade = calculateGrade(score.accuracy);
}

/**
 * Calculate grade from accuracy
 */
export function calculateGrade(accuracy: number): Grade {
  for (const [threshold, grade] of GRADE_THRESHOLDS) {
    if (accuracy >= threshold) {
      return grade;
    }
  }
  return 'F';
}

/**
 * Get display text for judgment
 */
export function getJudgmentText(judgment: Judgment): string {
  const texts: Record<Judgment, string> = {
    marvelous: 'MARVELOUS',
    perfect: 'PERFECT',
    great: 'GREAT',
    good: 'GOOD',
    miss: 'MISS'
  };
  return texts[judgment];
}

/**
 * Calculate final results
 */
export function getFinalResults(score: GameScore): {
  score: number;
  accuracy: number;
  grade: Grade;
  maxCombo: number;
  judgments: Record<Judgment, number>;
  fullCombo: boolean;
  perfectFullCombo: boolean;
  marvelousFullCombo: boolean;
} {
  const fullCombo = score.notesMissed === 0;
  const perfectFullCombo = fullCombo && score.judgments.great === 0 && score.judgments.good === 0;
  const marvelousFullCombo = perfectFullCombo && score.judgments.perfect === 0;

  return {
    score: score.score,
    accuracy: score.accuracy,
    grade: score.grade,
    maxCombo: score.maxCombo,
    judgments: { ...score.judgments },
    fullCombo,
    perfectFullCombo,
    marvelousFullCombo
  };
}
