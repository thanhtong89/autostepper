/**
 * Canvas-based game renderer
 * Draws scrolling arrows, receptors, and effects
 */

import type { Note } from '$lib/storage/db';
import type { Judgment } from './scoring';
import { JUDGMENT_COLORS } from './scoring';

// Arrow colors (matches CSS theme)
const ARROW_COLORS = {
  left: '#ff6b9d',   // pink
  down: '#4ecdc4',   // teal
  up: '#95e1d3',     // light green
  right: '#ffd93d'   // yellow
};

const LANE_ORDER = ['left', 'down', 'up', 'right'] as const;

export interface RendererConfig {
  // Visual settings
  scrollSpeed: number;      // Pixels per second
  receptorY: number;        // Y position of receptors (from top)
  arrowSize: number;        // Size of arrows in pixels
  laneGap: number;          // Gap between lanes

  // Appearance
  showCombo: boolean;
  showJudgment: boolean;
}

const DEFAULT_CONFIG: RendererConfig = {
  scrollSpeed: 600,         // 600 pixels per second
  receptorY: 100,           // Receptors near top
  arrowSize: 64,
  laneGap: 8,
  showCombo: true,
  showJudgment: true
};

export interface RenderState {
  // Active notes (notes currently on screen)
  visibleNotes: NoteRenderInfo[];

  // Visual effects
  judgmentDisplay: { text: string; color: string; time: number } | null;
  comboDisplay: number;
  receptorFlash: boolean[];  // Which receptors are currently pressed

  // Hold state
  activeHolds: Map<number, { lane: number; endTime: number }>;
}

interface NoteRenderInfo {
  note: Note;
  y: number;        // Current Y position
  hit: boolean;     // Already hit
  missed: boolean;  // Already missed
}

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RendererConfig;

  // Layout calculations
  private laneWidth: number = 0;
  private laneStartX: number = 0;
  private totalWidth: number = 0;

  // Device pixel ratio for crisp rendering
  private dpr: number = 1;

  // Cached logical dimensions (avoid repeated division in hot path)
  private _logicalWidth: number = 0;
  private _logicalHeight: number = 0;

  constructor(canvas: HTMLCanvasElement, config: Partial<RendererConfig> = {}) {
    this.canvas = canvas;

    // Get 2D context with optimizations for smooth animation
    const ctx = canvas.getContext('2d', {
      alpha: false,           // Opaque background - faster compositing
      desynchronized: true    // Allow canvas to update without waiting for vsync
    });
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    // Enable smooth rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dpr = window.devicePixelRatio || 1;
    this.calculateLayout();
  }

  private calculateLayout(): void {
    this.laneWidth = this.config.arrowSize + this.config.laneGap;
    this.totalWidth = this.laneWidth * 4 - this.config.laneGap;
    // Use logical width for centering
    this.laneStartX = (this.logicalWidth - this.totalWidth) / 2;
  }

  /**
   * Resize canvas to match container with high-DPI support
   */
  resize(width: number, height: number): void {
    this.dpr = window.devicePixelRatio || 1;

    // Set canvas size accounting for device pixel ratio (for crisp rendering)
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);

    // Cache logical dimensions for fast access in render loop
    this._logicalWidth = width;
    this._logicalHeight = height;

    // Scale context to match (so we can use logical pixels in drawing code)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Re-enable smooth rendering after resize
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.calculateLayout();
  }

  /**
   * Get logical canvas dimensions (cached for performance)
   */
  get logicalWidth(): number {
    return this._logicalWidth || this.canvas.width / this.dpr;
  }

  get logicalHeight(): number {
    return this._logicalHeight || this.canvas.height / this.dpr;
  }

  /**
   * Get Y position for a note at given time
   */
  getNoteY(noteTime: number, currentTime: number): number {
    const timeDiff = noteTime - currentTime;
    const pixelOffset = timeDiff * this.config.scrollSpeed;
    return this.config.receptorY + pixelOffset;
  }

  /**
   * Get X position for a lane (0-3)
   */
  getLaneX(lane: number): number {
    return this.laneStartX + lane * this.laneWidth;
  }

  /**
   * Main render function
   */
  render(state: RenderState, currentTime: number): void {
    const { ctx, config } = this;
    const width = this.logicalWidth;
    const height = this.logicalHeight;

    // Clear canvas (use logical dimensions)
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw lane guides (subtle vertical lines)
    this.drawLaneGuides();

    // Draw receptors
    this.drawReceptors(state.receptorFlash);

    // Draw hold tails first (behind tap notes)
    for (const note of state.visibleNotes) {
      if (note.note.type === 'hold' && !note.missed) {
        this.drawHoldTail(note, currentTime);
      }
    }

    // Draw notes
    for (const note of state.visibleNotes) {
      if (!note.hit && !note.missed) {
        this.drawNote(note);
      }
    }

    // Draw active hold bodies
    for (const [_, hold] of state.activeHolds) {
      this.drawActiveHold(hold, currentTime);
    }

    // Draw judgment
    if (config.showJudgment && state.judgmentDisplay) {
      this.drawJudgment(state.judgmentDisplay);
    }

    // Draw combo
    if (config.showCombo && state.comboDisplay > 1) {
      this.drawCombo(state.comboDisplay);
    }
  }

  private drawLaneGuides(): void {
    const { ctx, config } = this;
    const height = this.logicalHeight;

    ctx.strokeStyle = 'rgba(42, 42, 58, 0.5)';
    ctx.lineWidth = 1;

    for (let i = 0; i < 4; i++) {
      const x = this.getLaneX(i) + config.arrowSize / 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  private drawReceptors(flash: boolean[]): void {
    const { ctx, config } = this;
    const size = config.arrowSize;

    for (let i = 0; i < 4; i++) {
      const x = this.getLaneX(i);
      const y = config.receptorY - size / 2;
      const lane = LANE_ORDER[i];
      const color = ARROW_COLORS[lane];

      // Receptor background
      ctx.fillStyle = flash[i] ? color : 'rgba(42, 42, 58, 0.8)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Draw receptor shape (octagon-ish)
      this.drawArrowShape(x + size / 2, y + size / 2, size * 0.45, i, flash[i] ? 1 : 0.5);

      // Glow effect when pressed
      if (flash[i]) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        this.drawArrowShape(x + size / 2, y + size / 2, size * 0.45, i, 0.8);
        ctx.shadowBlur = 0;
      }
    }
  }

  private drawNote(noteInfo: NoteRenderInfo): void {
    const { note, y } = noteInfo;
    const { config } = this;
    const size = config.arrowSize;

    if (note.type === 'jump' && note.lanes) {
      // Draw both arrows for jump
      for (const lane of note.lanes) {
        const x = this.getLaneX(lane);
        const laneName = LANE_ORDER[lane];
        this.drawArrow(x + size / 2, y, size * 0.4, lane, ARROW_COLORS[laneName]);
      }
    } else if (note.lane !== undefined) {
      const x = this.getLaneX(note.lane);
      const laneName = LANE_ORDER[note.lane];
      this.drawArrow(x + size / 2, y, size * 0.4, note.lane, ARROW_COLORS[laneName]);
    }
  }

  private drawArrow(cx: number, cy: number, radius: number, lane: number, color: string): void {
    const { ctx } = this;

    ctx.save();
    ctx.translate(cx, cy);

    // Rotate based on lane direction (arrow shape points UP by default)
    // Canvas rotation: positive = clockwise, so:
    // -90° (CCW) = points LEFT, 180° = points DOWN, 0° = points UP, 90° (CW) = points RIGHT
    const rotations = [-Math.PI / 2, Math.PI, 0, Math.PI / 2]; // left, down, up, right
    ctx.rotate(rotations[lane]);

    // Arrow shape (pointing up by default)
    ctx.beginPath();
    ctx.moveTo(0, -radius);                          // Top point
    ctx.lineTo(radius * 0.6, radius * 0.3);          // Right wing
    ctx.lineTo(radius * 0.3, radius * 0.3);          // Right indent
    ctx.lineTo(radius * 0.3, radius);                // Right bottom
    ctx.lineTo(-radius * 0.3, radius);               // Left bottom
    ctx.lineTo(-radius * 0.3, radius * 0.3);         // Left indent
    ctx.lineTo(-radius * 0.6, radius * 0.3);         // Left wing
    ctx.closePath();

    // Fill and stroke
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private drawArrowShape(cx: number, cy: number, radius: number, lane: number, alpha: number): void {
    const { ctx } = this;
    const laneName = LANE_ORDER[lane];
    const color = ARROW_COLORS[laneName];

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);

    // Same rotation as drawArrow: left, down, up, right
    const rotations = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
    ctx.rotate(rotations[lane]);

    // Hollow arrow for receptor
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(radius * 0.6, radius * 0.3);
    ctx.lineTo(radius * 0.3, radius * 0.3);
    ctx.lineTo(radius * 0.3, radius);
    ctx.lineTo(-radius * 0.3, radius);
    ctx.lineTo(-radius * 0.3, radius * 0.3);
    ctx.lineTo(-radius * 0.6, radius * 0.3);
    ctx.closePath();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  private drawHoldTail(noteInfo: NoteRenderInfo, currentTime: number): void {
    const { note, y } = noteInfo;
    if (note.type !== 'hold' || note.lane === undefined || !note.endTime) return;

    const { ctx, config } = this;
    const x = this.getLaneX(note.lane) + config.arrowSize / 2;
    const endY = this.getNoteY(note.endTime, currentTime);
    const laneName = LANE_ORDER[note.lane];
    const color = ARROW_COLORS[laneName];

    // Draw hold body (rectangle connecting start to end)
    const bodyWidth = config.arrowSize * 0.3;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x - bodyWidth / 2, Math.min(y, endY), bodyWidth, Math.abs(endY - y));
    ctx.globalAlpha = 1;

    // Draw end cap
    ctx.beginPath();
    ctx.arc(x, endY, bodyWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawActiveHold(hold: { lane: number; endTime: number }, currentTime: number): void {
    const { ctx, config } = this;
    const x = this.getLaneX(hold.lane) + config.arrowSize / 2;
    const startY = config.receptorY;
    const endY = this.getNoteY(hold.endTime, currentTime);
    const laneName = LANE_ORDER[hold.lane];
    const color = ARROW_COLORS[laneName];

    // Draw active hold body from receptor to end
    const bodyWidth = config.arrowSize * 0.35;

    // Glowing effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x - bodyWidth / 2, Math.min(startY, endY), bodyWidth, Math.abs(endY - startY));
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
  }

  private drawJudgment(display: { text: string; color: string; time: number }): void {
    const { ctx } = this;
    const width = this.logicalWidth;
    const height = this.logicalHeight;
    const age = performance.now() - display.time;
    const fadeOut = Math.max(0, 1 - age / 500); // Fade over 500ms

    if (fadeOut <= 0) return;

    ctx.save();
    ctx.globalAlpha = fadeOut;
    ctx.font = 'bold 36px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text shadow
    ctx.shadowColor = display.color;
    ctx.shadowBlur = 10;

    ctx.fillStyle = display.color;
    ctx.fillText(display.text, width / 2, height / 2 - 50);

    ctx.restore();
  }

  private drawCombo(combo: number): void {
    const { ctx } = this;
    const width = this.logicalWidth;
    const height = this.logicalHeight;

    ctx.save();
    ctx.font = 'bold 48px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Combo number
    ctx.fillStyle = '#ffffff';
    ctx.fillText(combo.toString(), width / 2, height / 2);

    // "COMBO" label
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('COMBO', width / 2, height / 2 + 35);

    ctx.restore();
  }

  /**
   * Create judgment display data
   */
  createJudgmentDisplay(judgment: Judgment): { text: string; color: string; time: number } {
    const texts: Record<Judgment, string> = {
      marvelous: 'MARVELOUS',
      perfect: 'PERFECT',
      great: 'GREAT',
      good: 'GOOD',
      miss: 'MISS'
    };

    return {
      text: texts[judgment],
      color: JUDGMENT_COLORS[judgment],
      time: performance.now()
    };
  }

  /**
   * Get visible notes window (pre-calculate for culling)
   */
  getVisibleTimeWindow(currentTime: number): { start: number; end: number } {
    const screenTimeSpan = this.logicalHeight / this.config.scrollSpeed;
    return {
      start: currentTime - 0.5, // Allow some buffer after passing
      end: currentTime + screenTimeSpan + 0.5
    };
  }
}
