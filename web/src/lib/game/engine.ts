/**
 * Main game engine - coordinates input, scoring, and rendering
 */

import type { Note, DifficultyChart } from '$lib/storage/db';
import { initInput, destroyInput, pollInput, getLaneIndex, type Lane, type InputEvent } from './input';
import {
  createGameScore,
  recordJudgment,
  judgeHit,
  isValidHit,
  getFinalResults,
  HIT_WINDOWS,
  type GameScore,
  type Judgment
} from './scoring';
import { GameRenderer, type RenderState, type RendererConfig } from './renderer';

export type GameState = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished';

export interface GameConfig {
  // Timing
  countdownDuration: number;   // Seconds before song starts
  audioOffset: number;         // Audio sync adjustment (ms)

  // Gameplay
  scrollSpeed: number;         // Arrow scroll speed multiplier (1 = normal)

  // Renderer config
  renderer?: Partial<RendererConfig>;
}

const DEFAULT_CONFIG: GameConfig = {
  countdownDuration: 3,
  audioOffset: 0,
  scrollSpeed: 1
};

export interface GameCallbacks {
  onStateChange?: (state: GameState) => void;
  onScoreUpdate?: (score: GameScore) => void;
  onFinish?: (results: ReturnType<typeof getFinalResults>) => void;
}

interface NoteState {
  note: Note;
  hit: boolean;
  missed: boolean;
  holdActive: boolean;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private audio: HTMLAudioElement;
  private chart: DifficultyChart;
  private config: GameConfig;
  private callbacks: GameCallbacks;

  // State
  private state: GameState = 'idle';
  private score: GameScore;
  private renderer: GameRenderer;
  private noteStates: NoteState[] = [];

  // Timing - high precision interpolation
  private startTime: number = 0;
  private pauseTime: number = 0;
  private countdownRemaining: number = 0;

  // Smooth timing: interpolate between audio.currentTime updates
  private lastAudioTime: number = 0;
  private lastFrameTime: number = 0;
  private smoothTime: number = 0;

  // Render state
  private renderState: RenderState;
  private animationFrame: number = 0;

  // Input tracking
  private heldLanes: Set<number> = new Set();

  constructor(
    canvas: HTMLCanvasElement,
    audio: HTMLAudioElement,
    chart: DifficultyChart,
    config: Partial<GameConfig> = {},
    callbacks: GameCallbacks = {}
  ) {
    this.canvas = canvas;
    this.audio = audio;
    this.chart = chart;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;

    // Initialize renderer
    this.renderer = new GameRenderer(canvas, {
      scrollSpeed: 600 * this.config.scrollSpeed,
      ...this.config.renderer
    });

    // Initialize score
    this.score = createGameScore(chart.noteCount);

    // Initialize note states
    this.noteStates = chart.notes.map(note => ({
      note,
      hit: false,
      missed: false,
      holdActive: false
    }));

    // Initialize render state
    this.renderState = {
      visibleNotes: [],
      judgmentDisplay: null,
      comboDisplay: 0,
      receptorFlash: [false, false, false, false],
      activeHolds: new Map()
    };

    // Bind methods
    this.gameLoop = this.gameLoop.bind(this);
  }

  /**
   * Start the game (begins countdown)
   */
  start(): void {
    if (this.state !== 'idle') return;

    initInput();
    this.setState('countdown');
    this.countdownRemaining = this.config.countdownDuration;
    this.startTime = performance.now();

    // Start game loop
    this.animationFrame = requestAnimationFrame(this.gameLoop);
  }

  /**
   * Pause the game
   */
  pause(): void {
    if (this.state !== 'playing') return;

    this.audio.pause();
    this.pauseTime = performance.now();
    this.setState('paused');
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (this.state !== 'paused') return;

    // Adjust start time to account for pause
    const now = performance.now();
    const pauseDuration = now - this.pauseTime;
    this.startTime += pauseDuration;

    // Reset smooth timing to sync with current audio position
    this.lastAudioTime = this.audio.currentTime;
    this.lastFrameTime = now;
    this.smoothTime = this.audio.currentTime;

    this.audio.play();
    this.setState('playing');
  }

  /**
   * Stop and cleanup
   */
  stop(): void {
    cancelAnimationFrame(this.animationFrame);
    destroyInput();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.setState('idle');
  }

  /**
   * Get current state
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Get current score
   */
  getScore(): GameScore {
    return this.score;
  }

  private setState(newState: GameState): void {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
  }

  private gameLoop(): void {
    const now = performance.now();

    if (this.state === 'countdown') {
      this.updateCountdown(now);
    } else if (this.state === 'playing') {
      this.updatePlaying(now);
    } else if (this.state === 'paused') {
      // Just render, don't update
      this.render();
    }

    if (this.state !== 'idle' && this.state !== 'finished') {
      this.animationFrame = requestAnimationFrame(this.gameLoop);
    }
  }

  private updateCountdown(now: number): void {
    const elapsed = (now - this.startTime) / 1000;
    this.countdownRemaining = this.config.countdownDuration - elapsed;

    if (this.countdownRemaining <= 0) {
      // Start playing
      this.audio.currentTime = 0;
      this.audio.play();
      this.startTime = now;

      // Initialize smooth timing
      this.lastAudioTime = 0;
      this.lastFrameTime = now;
      this.smoothTime = 0;

      this.setState('playing');
    }

    this.render();
  }

  private updatePlaying(now: number): void {
    // High-precision time interpolation for smooth scrolling
    // audio.currentTime updates in chunks, so we interpolate between updates
    const rawAudioTime = this.audio.currentTime;

    if (rawAudioTime !== this.lastAudioTime) {
      // Audio time changed - sync our smooth time
      this.lastAudioTime = rawAudioTime;
      this.lastFrameTime = now;
      this.smoothTime = rawAudioTime;
    } else {
      // Audio time hasn't changed - interpolate based on elapsed real time
      const elapsed = (now - this.lastFrameTime) / 1000;
      this.smoothTime = this.lastAudioTime + elapsed;
    }

    // Use smooth time for rendering, raw audio time for game logic
    const currentTime = this.smoothTime + (this.config.audioOffset / 1000);
    const gameLogicTime = rawAudioTime + (this.config.audioOffset / 1000);

    // Process input (use raw audio time for accurate hit detection)
    const inputEvents = pollInput(gameLogicTime);
    this.processInput(inputEvents, gameLogicTime);

    // Check for missed notes
    this.checkMissedNotes(gameLogicTime);

    // Update hold states
    this.updateHolds(gameLogicTime);

    // Check if song finished
    if (this.audio.ended || rawAudioTime >= this.audio.duration) {
      this.finishGame();
      return;
    }

    // Update render state (use smooth time for visual smoothness)
    this.updateRenderState(currentTime);

    // Render
    this.render();

    // Notify score update
    this.callbacks.onScoreUpdate?.(this.score);
  }

  private processInput(events: InputEvent[], currentTime: number): void {
    for (const event of events) {
      const laneIndex = getLaneIndex(event.lane);

      if (event.pressed) {
        // Key pressed - check for note hit
        this.heldLanes.add(laneIndex);
        this.renderState.receptorFlash[laneIndex] = true;

        // Find closest unhit note in this lane within hit window
        const hitNote = this.findHittableNote(laneIndex, currentTime);
        if (hitNote) {
          this.hitNote(hitNote, currentTime);
        }
      } else {
        // Key released
        this.heldLanes.delete(laneIndex);
        this.renderState.receptorFlash[laneIndex] = false;

        // Check if releasing a hold
        this.checkHoldRelease(laneIndex, currentTime);
      }
    }
  }

  private findHittableNote(lane: number, currentTime: number): NoteState | null {
    let closest: NoteState | null = null;
    let closestDiff = Infinity;

    for (const noteState of this.noteStates) {
      if (noteState.hit || noteState.missed) continue;

      const { note } = noteState;

      // Check lane match
      if (note.type === 'jump' && note.lanes) {
        if (!note.lanes.includes(lane)) continue;
      } else if (note.lane !== lane) {
        continue;
      }

      // Check timing
      const diff = Math.abs(currentTime - note.time);
      if (isValidHit(currentTime, note.time) && diff < closestDiff) {
        closest = noteState;
        closestDiff = diff;
      }
    }

    return closest;
  }

  private hitNote(noteState: NoteState, currentTime: number): void {
    const { note } = noteState;
    const judgment = judgeHit(currentTime, note.time);

    noteState.hit = true;
    recordJudgment(this.score, judgment);

    // Show judgment
    this.renderState.judgmentDisplay = this.renderer.createJudgmentDisplay(judgment);
    this.renderState.comboDisplay = this.score.combo;

    // Handle hold start
    if (note.type === 'hold' && note.lane !== undefined && note.endTime) {
      noteState.holdActive = true;
      this.renderState.activeHolds.set(note.lane, {
        lane: note.lane,
        endTime: note.endTime
      });
    }

    // For jumps, we might need to track both lanes hit
    // Simplified: treat jump as hit when either lane is hit
  }

  private checkMissedNotes(currentTime: number): void {
    for (const noteState of this.noteStates) {
      if (noteState.hit || noteState.missed) continue;

      const { note } = noteState;
      const diff = currentTime - note.time;

      // Note is too late to hit
      if (diff > HIT_WINDOWS.good) {
        noteState.missed = true;
        recordJudgment(this.score, 'miss');

        this.renderState.judgmentDisplay = this.renderer.createJudgmentDisplay('miss');
        this.renderState.comboDisplay = 0;
      }
    }
  }

  private updateHolds(currentTime: number): void {
    for (const noteState of this.noteStates) {
      if (!noteState.holdActive) continue;

      const { note } = noteState;
      if (note.type !== 'hold' || note.lane === undefined || !note.endTime) continue;

      // Check if hold is complete
      if (currentTime >= note.endTime) {
        noteState.holdActive = false;
        this.renderState.activeHolds.delete(note.lane);
        // Award bonus for completed hold (already got initial hit)
      }

      // Check if hold was dropped (lane released too early)
      if (!this.heldLanes.has(note.lane) && currentTime < note.endTime - 0.1) {
        // Allow a small grace period
        noteState.holdActive = false;
        this.renderState.activeHolds.delete(note.lane);
        // Could penalize here
      }
    }
  }

  private checkHoldRelease(lane: number, currentTime: number): void {
    // Check if any active hold was released early
    const activeHold = this.renderState.activeHolds.get(lane);
    if (activeHold && currentTime < activeHold.endTime - 0.05) {
      // Released too early - remove active hold
      this.renderState.activeHolds.delete(lane);

      // Find the note and mark hold as inactive
      for (const noteState of this.noteStates) {
        if (noteState.holdActive && noteState.note.lane === lane) {
          noteState.holdActive = false;
        }
      }
    }
  }

  private updateRenderState(currentTime: number): void {
    const timeWindow = this.renderer.getVisibleTimeWindow(currentTime);

    this.renderState.visibleNotes = [];

    for (const noteState of this.noteStates) {
      const { note } = noteState;
      const noteTime = note.type === 'hold' && note.endTime
        ? Math.max(note.time, note.endTime)
        : note.time;

      // Check if note is visible
      if (note.time >= timeWindow.start && note.time <= timeWindow.end) {
        this.renderState.visibleNotes.push({
          note,
          y: this.renderer.getNoteY(note.time, currentTime),
          hit: noteState.hit,
          missed: noteState.missed
        });
      }
    }
  }

  private render(): void {
    if (this.state === 'countdown') {
      // Draw countdown - use renderer's logical dimensions for consistency
      const dpr = window.devicePixelRatio || 1;
      const ctx = this.canvas.getContext('2d')!;
      const width = this.canvas.width / dpr;
      const height = this.canvas.height / dpr;

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, width, height);

      ctx.font = 'bold 72px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      const count = Math.ceil(this.countdownRemaining);
      if (count > 0) {
        ctx.fillText(count.toString(), width / 2, height / 2);
      } else {
        ctx.fillText('GO!', width / 2, height / 2);
      }
    } else {
      // Normal game render
      const currentTime = this.audio.currentTime + (this.config.audioOffset / 1000);
      this.renderer.render(this.renderState, currentTime);
    }
  }

  private finishGame(): void {
    this.setState('finished');
    destroyInput();

    const results = getFinalResults(this.score);
    this.callbacks.onFinish?.(results);
  }

  /**
   * Handle resize
   */
  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }
}
