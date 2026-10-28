import { ToolError } from '@/lib/types';

export interface TunerResult {
  frequency: number;
  note: string;
  octave: number;
  cents: number;
  confidence: number;
}

/** Note names for each semitone (0 = C). */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Convert frequency to musical note info using equal temperament. */
export function frequencyToNote(freq: number, a4 = 440): TunerResult {
  if (!Number.isFinite(freq) || freq <= 0) {
    return { frequency: 0, note: '—', octave: 0, cents: 0, confidence: 0 };
  }

  // MIDI note number: A4 = 69
  const midi = 69 + 12 * Math.log2(freq / a4);
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);

  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;

  return {
    frequency: freq,
    note: NOTE_NAMES[noteIndex],
    octave,
    cents,
    confidence: 1, // will be set by caller
  };
}

/**
 * YIN pitch detection algorithm.
 * Returns fundamental frequency in Hz, or 0 if not found.
 * Based on the YIN paper by de Cheveigné and Kawahara (2002).
 */
export function yinPitch(
  buffer: Float32Array,
  sampleRate: number,
  options: {
    minFreq?: number;
    maxFreq?: number;
    threshold?: number;
  } = {}
): number {
  const { minFreq = 20, maxFreq = 2000, threshold = 0.15 } = options;

  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.min(Math.floor(sampleRate / minFreq), buffer.length >> 1);
  if (maxPeriod <= minPeriod) return 0;

  const len = buffer.length;
  const yinBuffer = new Float32Array(maxPeriod);

  // Step 1: Difference function
  for (let tau = minPeriod; tau < maxPeriod; tau++) {
    let sum = 0;
    for (let i = 0; i < len - tau; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < maxPeriod; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] *= tau / runningSum;
  }

  // Step 3: Absolute threshold
  let tau = minPeriod;
  while (tau < maxPeriod) {
    if (yinBuffer[tau] < threshold) {
      // Step 4: Parabolic interpolation
      while (tau + 1 < maxPeriod && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      if (tau > 0 && tau < maxPeriod - 1) {
        const y1 = yinBuffer[tau - 1];
        const y2 = yinBuffer[tau];
        const y3 = yinBuffer[tau + 1];
        const shift = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
        const period = tau + shift;
        return sampleRate / period;
      }
      return sampleRate / tau;
    }
    tau++;
  }

  // Step 5: Best local minimum if threshold not met
  let bestTau = minPeriod;
  let bestVal = yinBuffer[minPeriod];
  for (let t = minPeriod + 1; t < maxPeriod; t++) {
    if (yinBuffer[t] < bestVal) {
      bestVal = yinBuffer[t];
      bestTau = t;
    }
  }
  if (bestVal < threshold * 1.5) {
    return sampleRate / bestTau;
  }

  return 0;
}

/**
 * Autocorrelation pitch detection (simpler, faster alternative to YIN).
 */
export function autocorrPitch(
  buffer: Float32Array,
  sampleRate: number,
  options: {
    minFreq?: number;
    maxFreq?: number;
  } = {}
): number {
  const { minFreq = 20, maxFreq = 2000 } = options;

  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.min(Math.floor(sampleRate / minFreq), buffer.length >> 1);
  if (maxPeriod <= minPeriod) return 0;

  let bestPeriod = 0;
  let bestCorr = -1;

  for (let tau = minPeriod; tau < maxPeriod; tau++) {
    let corr = 0;
    let norm = 0;
    for (let i = 0; i < buffer.length - tau; i++) {
      corr += buffer[i] * buffer[i + tau];
      norm += buffer[i] * buffer[i];
    }
    if (norm > 0) {
      corr /= Math.sqrt(norm);
      if (corr > bestCorr) {
        bestCorr = corr;
        bestPeriod = tau;
      }
    }
  }

  if (bestPeriod > 0 && bestCorr > 0.3) {
    return sampleRate / bestPeriod;
  }
  return 0;
}

/**
 * Apply a simple high-pass filter to remove DC and low-frequency rumble.
 */
export function highPassFilter(input: Float32Array, sampleRate: number, cutoff = 80): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);

  const output = new Float32Array(input.length);
  let prevIn = 0;
  let prevOut = 0;

  for (let i = 0; i < input.length; i++) {
    output[i] = alpha * (prevOut + input[i] - prevIn);
    prevIn = input[i];
    prevOut = output[i];
  }

  return output;
}

/**
 * RMS-based voice activity detection to skip silence.
 */
export function isVoiceActive(buffer: Float32Array, threshold = 0.01): boolean {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sum / buffer.length);
  return rms > threshold;
}

/**
 * Get available audio input devices.
 */
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new ToolError('MediaDevices API not supported.');
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'audioinput');
}

/**
 * Start microphone stream with given constraints.
 */
export async function startMicStream(deviceId?: string): Promise<MediaStream> {
  try {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        deviceId: deviceId ? { exact: deviceId } : undefined,
      },
      video: false,
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      throw new ToolError('Microphone access denied. Please allow microphone access in your browser settings.');
    }
    if (e instanceof DOMException && e.name === 'NotFoundError') {
      throw new ToolError('No microphone found. Please connect a microphone and try again.');
    }
    throw new ToolError(`Could not start microphone: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}