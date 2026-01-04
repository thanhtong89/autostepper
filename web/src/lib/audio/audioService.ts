/**
 * Unified Audio Service
 *
 * Simple audio playback using Web Audio API with pre-decoded AudioBuffer.
 * Same approach for both preview and gameplay - just different playback parameters.
 *
 * Key advantage: audioContext.currentTime is a high-precision monotonic clock
 * that doesn't suffer from the chunky updates of HTMLAudioElement.currentTime
 */

export interface AudioPlaybackOptions {
  offset?: number;        // Start position in seconds (default: 0)
  duration?: number;      // Play duration in seconds (default: full length)
  loop?: boolean;         // Loop playback (default: false)
  volume?: number;        // Volume 0-1 (default: 1)
}

interface AudioState {
  isPlaying: boolean;
  startContextTime: number;  // audioContext.currentTime when playback started
  startOffset: number;       // Position in audio where playback started
  pauseOffset: number;       // Position when paused (for resume)
  duration: number;          // Total audio duration
  playDuration: number;      // How long to play (for segments)
  loop: boolean;
}

class AudioService {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private audioGain: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;

  private state: AudioState = {
    isPlaying: false,
    startContextTime: 0,
    startOffset: 0,
    pauseOffset: 0,
    duration: 0,
    playDuration: 0,
    loop: false
  };

  /**
   * Get or create the shared AudioContext
   */
  getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);

      this.audioGain = this.context.createGain();
      this.audioGain.connect(this.masterGain);
    }
    return this.context;
  }

  /**
   * Ensure AudioContext is running (required after user interaction)
   */
  async ensureRunning(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  /**
   * Check if audio is currently loaded
   */
  isLoaded(): boolean {
    return this.audioBuffer !== null;
  }

  /**
   * Get loaded audio duration
   */
  getDuration(): number {
    return this.state.duration;
  }

  /**
   * Load and decode audio from blob
   * Returns the audio duration
   */
  async loadAudio(blob: Blob): Promise<number> {
    await this.ensureRunning();
    const ctx = this.getContext();

    // Stop any current playback
    this.stop();

    // Decode the audio
    const arrayBuffer = await blob.arrayBuffer();
    this.audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    this.state.duration = this.audioBuffer.duration;
    this.state.pauseOffset = 0;
    this.state.isPlaying = false;

    return this.audioBuffer.duration;
  }

  /**
   * Start audio playback
   */
  play(options: AudioPlaybackOptions = {}): void {
    if (!this.audioBuffer || !this.context || !this.audioGain) {
      console.error('Audio not loaded');
      return;
    }

    const {
      offset = 0,
      duration,
      loop = false,
      volume = 1
    } = options;

    // Stop any existing playback
    this.stopSource();

    // Set volume
    this.audioGain.gain.value = Math.max(0, Math.min(1, volume));

    // Create new source node (AudioBufferSourceNode is single-use)
    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.loop = loop;
    this.sourceNode.connect(this.audioGain);

    // For looping segments, set loop points
    if (loop && duration) {
      this.sourceNode.loopStart = offset;
      this.sourceNode.loopEnd = offset + duration;
    }

    // Track timing state
    const startOffset = offset >= 0 ? offset : this.state.pauseOffset;
    const playDuration = duration ?? (this.state.duration - startOffset);

    this.state.startContextTime = this.context.currentTime;
    this.state.startOffset = startOffset;
    this.state.pauseOffset = startOffset;
    this.state.playDuration = playDuration;
    this.state.loop = loop;
    this.state.isPlaying = true;

    // Start playback
    if (loop) {
      // For loops, start and let it loop indefinitely
      this.sourceNode.start(0, startOffset);
    } else if (duration) {
      // Play for specific duration
      this.sourceNode.start(0, startOffset, duration);
    } else {
      // Play from offset to end
      this.sourceNode.start(0, startOffset);
    }

    // Handle natural end (for non-looping playback)
    this.sourceNode.onended = () => {
      if (this.state.isPlaying && !this.state.loop) {
        this.state.isPlaying = false;
      }
    };
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.state.isPlaying || !this.context) return;

    // Calculate current position
    const elapsed = this.context.currentTime - this.state.startContextTime;
    this.state.pauseOffset = this.state.startOffset + elapsed;
    this.state.isPlaying = false;

    this.stopSource();
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (this.state.isPlaying || !this.audioBuffer) return;

    this.play({
      offset: this.state.pauseOffset,
      loop: this.state.loop,
      duration: this.state.loop ? this.state.playDuration : undefined
    });
  }

  /**
   * Stop playback and reset position
   */
  stop(): void {
    this.stopSource();
    this.state.isPlaying = false;
    this.state.pauseOffset = 0;
    this.state.startOffset = 0;
  }

  /**
   * Get current playback position (high-precision)
   */
  getCurrentTime(): number {
    if (!this.context) return 0;

    if (this.state.isPlaying) {
      const elapsed = this.context.currentTime - this.state.startContextTime;
      let position = this.state.startOffset + elapsed;

      // Handle looping
      if (this.state.loop && this.state.playDuration > 0) {
        const loopStart = this.state.startOffset;
        const loopDuration = this.state.playDuration;
        position = loopStart + ((position - loopStart) % loopDuration);
      }

      return position;
    }

    return this.state.pauseOffset;
  }

  /**
   * Check if playing
   */
  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  /**
   * Check if playback has ended (for non-looping)
   */
  hasEnded(): boolean {
    if (this.state.loop) return false;
    return this.getCurrentTime() >= this.state.duration;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.audioGain) {
      this.audioGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Unload audio buffer to free memory
   */
  unload(): void {
    this.stop();
    this.audioBuffer = null;
    this.state.duration = 0;
  }

  private stopSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // Already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.unload();

    if (this.audioGain) {
      this.audioGain.disconnect();
      this.audioGain = null;
    }

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();

// Also export class for testing
export { AudioService };
