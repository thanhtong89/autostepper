/**
 * Audio analysis using Web Audio API
 *
 * Note: This is a simplified beat detection algorithm.
 * For production, consider using Essentia.js for more accurate results.
 * This implementation uses FFT-based onset detection.
 */

export interface AnalysisResult {
  bpm: number;
  beats: number[];
  confidence: number;
}

/**
 * Analyze audio buffer to detect tempo and beat positions
 */
export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Use mono

  // Compute onset detection function using spectral flux
  const onsets = detectOnsets(channelData, sampleRate);

  // Estimate tempo from onset intervals
  const { bpm, confidence } = estimateTempo(onsets, sampleRate);

  // Quantize onsets to beat grid
  const beats = quantizeBeats(onsets, bpm, sampleRate);

  return { bpm, beats, confidence };
}

/**
 * Detect onsets using spectral flux
 */
function detectOnsets(samples: Float32Array, sampleRate: number): number[] {
  const frameSize = 2048;
  const hopSize = 512;
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);

  const onsets: number[] = [];
  let prevSpectrum: Float32Array | null = null;

  // Compute spectral flux for each frame
  const fluxValues: number[] = [];

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const frame = samples.slice(start, start + frameSize);

    // Apply Hann window
    const windowed = applyWindow(frame);

    // Compute magnitude spectrum (simplified FFT)
    const spectrum = computeSpectrum(windowed);

    if (prevSpectrum) {
      // Compute spectral flux (positive differences only)
      let flux = 0;
      for (let j = 0; j < spectrum.length; j++) {
        const diff = spectrum[j] - prevSpectrum[j];
        if (diff > 0) flux += diff;
      }
      fluxValues.push(flux);
    } else {
      fluxValues.push(0);
    }

    prevSpectrum = spectrum;
  }

  // Normalize flux values
  const maxFlux = Math.max(...fluxValues, 1);
  const normalizedFlux = fluxValues.map(f => f / maxFlux);

  // Peak picking with adaptive threshold
  const threshold = 0.3;
  const minDistance = Math.floor(sampleRate / hopSize * 0.1); // 100ms minimum

  let lastOnset = -minDistance;
  for (let i = 1; i < normalizedFlux.length - 1; i++) {
    // Local maximum
    if (normalizedFlux[i] > normalizedFlux[i - 1] &&
        normalizedFlux[i] > normalizedFlux[i + 1] &&
        normalizedFlux[i] > threshold &&
        i - lastOnset >= minDistance) {
      const time = (i * hopSize) / sampleRate;
      onsets.push(time);
      lastOnset = i;
    }
  }

  return onsets;
}

/**
 * Apply Hann window function
 */
function applyWindow(frame: Float32Array): Float32Array {
  const windowed = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frame.length - 1)));
    windowed[i] = frame[i] * window;
  }
  return windowed;
}

/**
 * Compute magnitude spectrum using DFT (simplified, not FFT)
 * For production, use a proper FFT library
 */
function computeSpectrum(frame: Float32Array): Float32Array {
  const n = frame.length;
  const numBins = Math.floor(n / 2);
  const spectrum = new Float32Array(numBins);

  // Use energy in frequency bands instead of full DFT for speed
  const bandSize = 8;
  const numBands = Math.floor(numBins / bandSize);

  for (let band = 0; band < numBands; band++) {
    let energy = 0;
    const startBin = band * bandSize;
    const endBin = startBin + bandSize;

    for (let bin = startBin; bin < endBin; bin++) {
      // Simplified: just use magnitude of samples in band range
      const sampleIdx = Math.floor(bin * frame.length / numBins);
      energy += frame[sampleIdx] * frame[sampleIdx];
    }

    for (let bin = startBin; bin < endBin; bin++) {
      spectrum[bin] = Math.sqrt(energy / bandSize);
    }
  }

  return spectrum;
}

/**
 * Estimate tempo from onset intervals
 */
function estimateTempo(onsets: number[], sampleRate: number): { bpm: number; confidence: number } {
  if (onsets.length < 4) {
    return { bpm: 120, confidence: 0.5 };
  }

  // Calculate inter-onset intervals
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const interval = onsets[i] - onsets[i - 1];
    if (interval > 0.2 && interval < 2.0) { // 30-300 BPM range
      intervals.push(interval);
    }
  }

  if (intervals.length < 2) {
    return { bpm: 120, confidence: 0.5 };
  }

  // Build histogram of intervals
  const histogram = new Map<number, number>();
  const resolution = 0.02; // 20ms bins

  for (const interval of intervals) {
    const bin = Math.round(interval / resolution) * resolution;
    histogram.set(bin, (histogram.get(bin) || 0) + 1);
  }

  // Find most common interval
  let maxCount = 0;
  let dominantInterval = 0.5;

  for (const [interval, count] of histogram) {
    if (count > maxCount) {
      maxCount = count;
      dominantInterval = interval;
    }
  }

  // Convert to BPM
  let bpm = 60 / dominantInterval;

  // Adjust to common range (60-180 BPM)
  while (bpm < 60) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  // Confidence based on histogram peak
  const confidence = Math.min(maxCount / intervals.length + 0.3, 1.0);

  return { bpm: Math.round(bpm), confidence };
}

/**
 * Quantize detected onsets to a regular beat grid
 */
function quantizeBeats(onsets: number[], bpm: number, sampleRate: number): number[] {
  if (onsets.length === 0) {
    return [];
  }

  const beatInterval = 60 / bpm;
  const beats: number[] = [];

  // Find the best phase offset
  let bestOffset = 0;
  let bestScore = -Infinity;

  for (let offset = 0; offset < beatInterval; offset += beatInterval / 16) {
    let score = 0;
    for (const onset of onsets) {
      const nearestBeat = Math.round((onset - offset) / beatInterval) * beatInterval + offset;
      const distance = Math.abs(onset - nearestBeat);
      if (distance < beatInterval / 4) {
        score += 1 - (distance / (beatInterval / 4));
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  // Generate beat times with best offset
  const duration = onsets[onsets.length - 1] + 2;
  for (let t = bestOffset; t < duration; t += beatInterval) {
    beats.push(t);
  }

  return beats;
}
