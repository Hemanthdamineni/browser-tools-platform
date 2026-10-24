import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWavHeader,
  ChunkAccumulator,
  extensionForFormat,
  floatToPcm16,
  formatDuration,
  formatElapsed,
  formatForMimeType,
  mountVoiceRecorderPanel,
  peakFromByteData,
  pickMimeType,
  recordingFileName,
  rmsFromByteData,
  smoothLevel,
  supportsWebm,
  updateLevelMeter,
} from './voice-recorder-panel';
import { runToolById } from '@/lib/worker/client';

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                      */
/* -------------------------------------------------------------------------- */

vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

const runToolByIdMock = vi.mocked(runToolById);

/* -------------------------------------------------------------------------- */
/*  Elapsed time                                                               */
/* -------------------------------------------------------------------------- */

describe('elapsed time', () => {
  it('formats the running timer', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(-5)).toBe('0:00');
    expect(formatElapsed(Number.NaN)).toBe('0:00');
  });

  it('formats a finished duration', () => {
    expect(formatDuration(3.42)).toBe('3.4 s');
    expect(formatDuration(65)).toBe('1 m 05 s');
    expect(formatDuration(3661)).toBe('1 h 01 m 01 s');
    expect(formatDuration(-1)).toBe('Unknown');
  });
});

/* -------------------------------------------------------------------------- */
/*  Level meter                                                                */
/* -------------------------------------------------------------------------- */

describe('level meter', () => {
  it('computes RMS from analyser byte data (centre 128)', () => {
    expect(rmsFromByteData(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    // Bytes 255 and 0 are +0.9921875 and -1, whose RMS is ≈0.9961.
    expect(rmsFromByteData(new Uint8Array([255, 0, 255, 0]))).toBeCloseTo(0.9961, 4);
    expect(rmsFromByteData(new Uint8Array([192, 64, 192, 64]))).toBeCloseTo(0.5, 5);
  });

  it('computes the peak from analyser byte data', () => {
    expect(peakFromByteData(new Uint8Array([128, 64, 128]))).toBeCloseTo(0.5, 5);
    expect(peakFromByteData(new Uint8Array([128, 255]))).toBeCloseTo(0.9921875, 5);
  });

  it('smooths a value toward its target', () => {
    expect(smoothLevel(0, 1, 0.5)).toBeCloseTo(0.5, 5);
    expect(smoothLevel(0.5, 1, 1)).toBeCloseTo(1, 5);
    expect(smoothLevel(0.5, 1, 0.25)).toBeCloseTo(0.625, 5);
  });

  it('advances the meter and never lets it jump', () => {
    const first = updateLevelMeter(null, new Uint8Array([192, 64, 192, 64]), 0.3);
    expect(first.samples).toBe(1);
    expect(first.rms).toBeCloseTo(0.5, 5);

    const louder = updateLevelMeter(first, new Uint8Array([255, 0, 255, 0]), 0.3);
    expect(louder.rms).toBeGreaterThan(first.rms);
    expect(louder.rms).toBeLessThan(1);
    expect(louder.samples).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Filename and MIME selection                                                */
/* -------------------------------------------------------------------------- */

describe('filename and MIME selection', () => {
  it('maps a format to an extension', () => {
    expect(extensionForFormat('wav')).toBe('wav');
    expect(extensionForFormat('webm')).toBe('webm');
  });

  it('names a take with a timestamp and the right extension', () => {
    const when = new Date(2026, 9, 24, 9, 5, 3); // 2026-10-24 09:05:03
    expect(recordingFileName('wav', when)).toBe('voice-recording-2026-10-24-09-05-03.wav');
    expect(recordingFileName('webm', when)).toBe('voice-recording-2026-10-24-09-05-03.webm');
  });

  it('picks the MIME type the browser can actually record', () => {
    expect(pickMimeType((t) => t === 'audio/webm;codecs=opus')).toBe('audio/webm;codecs=opus');
    expect(pickMimeType(() => false)).toBeNull();
    expect(supportsWebm((t) => t.startsWith('audio/webm'))).toBe(true);
  });

  it('reads the container from a MIME type', () => {
    expect(formatForMimeType('audio/wav')).toBe('wav');
    expect(formatForMimeType('audio/webm;codecs=opus')).toBe('webm');
    expect(formatForMimeType('video/mp4')).toBeNull();
    expect(formatForMimeType('')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  WAV header — byte for byte                                                 */
/* -------------------------------------------------------------------------- */

describe('WAV header writer', () => {
  it('writes a canonical 44-byte RIFF header for a mono 8 kHz take', () => {
    const header = buildWavHeader({
      sampleRate: 8000,
      numChannels: 1,
      bitsPerSample: 16,
      dataBytes: 16000,
    });
    expect(header.byteLength).toBe(44);

    const expected = [
      0x52, 0x49, 0x46, 0x46, // RIFF
      0xa4, 0x3e, 0x00, 0x00, // 36 + 16000 = 16036 LE
      0x57, 0x41, 0x56, 0x45, // WAVE
      0x66, 0x6d, 0x74, 0x20, // 'fmt '
      0x10, 0x00, 0x00, 0x00, // fmt chunk size = 16
      0x01, 0x00, // PCM
      0x01, 0x00, // 1 channel
      0x40, 0x1f, 0x00, 0x00, // 8000 Hz
      0x80, 0x3e, 0x00, 0x00, // byte rate = 16000
      0x02, 0x00, // block align = 2
      0x10, 0x00, // 16 bits
      0x64, 0x61, 0x74, 0x61, // 'data'
      0x80, 0x3e, 0x00, 0x00, // data bytes = 16000
    ];
    expect(Array.from(header)).toEqual(expected);
  });

  it('writes a stereo 48 kHz header with the correct byte rate', () => {
    const header = buildWavHeader({
      sampleRate: 48000,
      numChannels: 2,
      bitsPerSample: 16,
      dataBytes: 192000,
    });
    const view = new DataView(header.buffer);
    expect(header.byteLength).toBe(44);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(28, true)).toBe(48000 * 2 * 2);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint32(40, true)).toBe(192000);
    expect(view.getUint32(4, true)).toBe(36 + 192000);
  });

  it('interleaves float samples into little-endian PCM', () => {
    const mono = floatToPcm16([new Float32Array([0, 0.5, -0.5, -1, 1])], 5);
    const view = new DataView(mono.buffer);
    expect(mono.byteLength).toBe(10);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(0x4000); // +0.5 -> round(16383.5) = 16384
    expect(view.getInt16(4, true)).toBe(-0x4000); // -0.5 -> -16384
    expect(view.getInt16(6, true)).toBe(-0x8000); // -1 -> -32768
    expect(view.getInt16(8, true)).toBe(0x7fff); // +1 -> 32767
  });

  it('interleaves two channels sample-by-sample', () => {
    const left = new Float32Array([0, 1]);
    const right = new Float32Array([1, -1]);
    const stereo = floatToPcm16([left, right], 2);
    const view = new DataView(stereo.buffer);
    expect(stereo.byteLength).toBe(8);
    expect(view.getInt16(0, true)).toBe(0); // L[0]
    expect(view.getInt16(2, true)).toBe(0x7fff); // R[0]
    expect(view.getInt16(4, true)).toBe(0x7fff); // L[1]
    expect(view.getInt16(6, true)).toBe(-0x8000); // R[1]
  });
});

/* -------------------------------------------------------------------------- */
/*  Chunk accumulation + checkpoints                                           */
/* -------------------------------------------------------------------------- */

describe('chunk accumulator', () => {
  it('accumulates chunks in order and reports size', () => {
    const acc = new ChunkAccumulator();
    acc.add(new Uint8Array([1, 2, 3]));
    acc.add(new Uint8Array([4, 5]));
    expect(acc.count).toBe(2);
    expect(acc.size).toBe(5);
    expect(Array.from(acc.bytes())).toEqual([1, 2, 3, 4, 5]);
  });

  it('ignores empty chunks', () => {
    const acc = new ChunkAccumulator();
    acc.add(new Uint8Array(0));
    expect(acc.count).toBe(0);
    expect(acc.size).toBe(0);
  });

  it('keeps the last chunk when stop appends it', () => {
    const acc = new ChunkAccumulator();
    acc.add(new Uint8Array([9, 9]));
    acc.add(new Uint8Array([7, 8]));
    expect(acc.count).toBe(2);
    expect(Array.from(acc.bytes())).toEqual([9, 9, 7, 8]);
  });

  it('rebuilds a take from checkpointed chunks in order', () => {
    // A crash checkpoint is read back as one chunk per recorded second, so the
    // accumulator must preserve their order exactly.
    const restored = new ChunkAccumulator();
    restored.add(new Uint8Array([1, 2, 3]));
    restored.add(new Uint8Array([4, 5]));
    expect(restored.count).toBe(2);
    expect(Array.from(restored.bytes())).toEqual([1, 2, 3, 4, 5]);
  });

  it('accepts an ArrayBuffer chunk as well as a Uint8Array', () => {
    const acc = new ChunkAccumulator();
    acc.add(new Uint8Array([9]).buffer);
    acc.add(new Uint8Array([8]));
    expect(acc.count).toBe(2);
    expect(Array.from(acc.bytes())).toEqual([9, 8]);
  });

  it('resets to an empty take', () => {
    const acc = new ChunkAccumulator();
    acc.add(new Uint8Array([1]));
    acc.reset();
    expect(acc.count).toBe(0);
    expect(acc.size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Panel mount                                                                */
/* -------------------------------------------------------------------------- */

class FakeTrack {
  stopped = false;
  constructor(readonly kind: 'audio') {}
  stop(): void {
    this.stopped = true;
  }
}

class FakeStream {
  constructor(private readonly tracks: FakeTrack[] = []) {}
  getTracks(): FakeTrack[] {
    return this.tracks;
  }
  getAudioTracks(): FakeTrack[] {
    return this.tracks;
  }
}

class FakeMediaRecorder {
  static supported = new Set<string>(['audio/webm;codecs=opus', 'audio/webm']);
  static instances: FakeMediaRecorder[] = [];

  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(
    public readonly stream: FakeStream,
    options?: { mimeType?: string },
  ) {
    this.mimeType = options?.mimeType ?? '';
    FakeMediaRecorder.instances.push(this);
  }

  static isTypeSupported(type: string): boolean {
    return FakeMediaRecorder.supported.has(type);
  }

  start(): void {
    this.state = 'recording';
  }

  pause(): void {
    this.state = 'paused';
  }

  resume(): void {
    this.state = 'recording';
  }

  requestData(): void {
    /* no-op */
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}

function installDevices(getUserMedia: () => Promise<FakeStream>): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia } as unknown as MediaDevices,
    configurable: true,
  });
}

/** The markup voice-recorder.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.voiceRecorder = '';
  root.dataset.toolId = 'voice-recorder';
  root.innerHTML = `
    <button type="button" data-vr-mic aria-pressed="false">Microphone</button>
    <button type="button" data-vr-record disabled>Record</button>
    <button type="button" data-vr-pause hidden>Pause</button>
    <button type="button" data-vr-resume hidden>Resume</button>
    <button type="button" data-vr-stop hidden>Stop</button>
    <button type="button" data-vr-discard hidden>Discard</button>
    <select data-vr-format>
      <option value="wav">WAV</option>
      <option value="webm">WebM</option>
    </select>
    <span data-vr-rec-badge hidden></span>
    <span data-vr-timer role="timer">0:00</span>
    <div data-vr-meter-fill></div>
    <div data-vr-meter-peak></div>
    <span data-vr-level-readout></span>
    <span data-vr-level-word></span>
    <p data-vr-live role="status"></p>
    <p data-vr-status role="status"></p>
    <div data-vr-error hidden></div>
    <div data-vr-clip-wrap hidden>
      <audio data-vr-audio></audio>
      <a data-vr-download href="#" download>Download</a>
      <a data-vr-trim href="/tools/audio-trim">Trim it next</a>
      <p data-vr-clip-meta></p>
    </div>
    <div data-vr-result-wrap hidden>
      <div data-vr-report hidden></div>
      <ul data-vr-outputs></ul>
      <ul data-vr-notes></ul>
    </div>
  `;
  document.body.append(root);
  return root;
}

const query = <T extends Element>(root: HTMLElement, selector: string): T =>
  root.querySelector<T>(selector)!;

let originalMediaRecorder: unknown;
let originalMediaStream: unknown;
let originalAudioContext: unknown;

beforeEach(() => {
  originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;
  originalMediaStream = (globalThis as Record<string, unknown>).MediaStream;
  originalAudioContext = (globalThis as Record<string, unknown>).AudioContext;
  (globalThis as Record<string, unknown>).MediaRecorder = FakeMediaRecorder;
  (globalThis as Record<string, unknown>).MediaStream = FakeStream;
  // jsdom has neither Web Audio nor IndexedDB; the panel guards both.
  (globalThis as Record<string, unknown>).AudioContext = undefined;
  (navigator as unknown as Record<string, unknown>).mediaDevices = undefined;
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.supported = new Set(['audio/webm;codecs=opus', 'audio/webm']);
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({
    outputs: [{ filename: 'voice-recording.webm', blob: new Blob(['audio']) }],
    notes: ['Captured in this tab.'],
  } as never);
});

afterEach(() => {
  (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
  (globalThis as Record<string, unknown>).MediaStream = originalMediaStream;
  (globalThis as Record<string, unknown>).AudioContext = originalAudioContext;
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('mountVoiceRecorderPanel', () => {
  it('starts with the recorder disabled until the microphone is open', () => {
    installDevices(async () => new FakeStream([new FakeTrack('audio')]));
    const root = fixture();
    mountVoiceRecorderPanel(root);
    expect(query<HTMLButtonElement>(root, '[data-vr-record]').disabled).toBe(true);
    expect(query<HTMLElement>(root, '[data-vr-meter-fill]')).toBeTruthy();
  });

  it('opens the microphone and enables recording', async () => {
    installDevices(async () => new FakeStream([new FakeTrack('audio')]));
    const root = fixture();
    mountVoiceRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-vr-mic]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-vr-record]').disabled).toBe(false);
    });
    expect(query<HTMLButtonElement>(root, '[data-vr-mic]').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(query<HTMLElement>(root, '[data-vr-status]').textContent).toMatch(/microphone on/i);
  });

  it('explains a denied microphone instead of crashing', async () => {
    installDevices(async () => {
      throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    });
    const root = fixture();
    mountVoiceRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-vr-mic]').click();
    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-vr-error]').hidden).toBe(false);
    });
    expect(query<HTMLElement>(root, '[data-vr-error]').textContent).toMatch(/denied/i);
    expect(query<HTMLButtonElement>(root, '[data-vr-record]').disabled).toBe(true);
  });

  it('records a WebM take and hands it to the tool', async () => {
    installDevices(async () => new FakeStream([new FakeTrack('audio')]));
    const root = fixture();
    mountVoiceRecorderPanel(root);

    query<HTMLSelectElement>(root, '[data-vr-format]').value = 'webm';
    query<HTMLSelectElement>(root, '[data-vr-format]').dispatchEvent(new Event('change'));

    query<HTMLButtonElement>(root, '[data-vr-mic]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-vr-record]').disabled).toBe(false);
    });

    query<HTMLButtonElement>(root, '[data-vr-record]').click();
    expect(query<HTMLButtonElement>(root, '[data-vr-stop]').hidden).toBe(false);
    expect(FakeMediaRecorder.instances).toHaveLength(1);

    query<HTMLButtonElement>(root, '[data-vr-stop]').click();

    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    });
    const [toolId, payload] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('voice-recorder');
    const recorded = (payload.files as File[])[0]!;
    expect(recorded.name).toMatch(/^voice-recording-\d{8}-\d{6}\.webm$/);
    expect(payload.options).toMatchObject({ format: 'webm' });

    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-vr-clip-wrap]').hidden).toBe(false);
    });
  });

  it('pauses and resumes a take', async () => {
    installDevices(async () => new FakeStream([new FakeTrack('audio')]));
    const root = fixture();
    mountVoiceRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-vr-mic]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-vr-record]').disabled).toBe(false);
    });
    query<HTMLButtonElement>(root, '[data-vr-record]').click();

    query<HTMLButtonElement>(root, '[data-vr-pause]').click();
    expect(query<HTMLButtonElement>(root, '[data-vr-resume]').hidden).toBe(false);
    expect(query<HTMLButtonElement>(root, '[data-vr-pause]').hidden).toBe(true);
    expect(query<HTMLElement>(root, '[data-vr-status]').textContent).toMatch(/paused/i);

    query<HTMLButtonElement>(root, '[data-vr-resume]').click();
    expect(query<HTMLButtonElement>(root, '[data-vr-pause]').hidden).toBe(false);
    expect(query<HTMLElement>(root, '[data-vr-status]').textContent).toMatch(/resumed/i);
  });

  it('discards a take and clears the clip', async () => {
    installDevices(async () => new FakeStream([new FakeTrack('audio')]));
    const root = fixture();
    mountVoiceRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-vr-mic]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-vr-record]').disabled).toBe(false);
    });
    query<HTMLButtonElement>(root, '[data-vr-record]').click();
    query<HTMLButtonElement>(root, '[data-vr-discard]').click();

    expect(query<HTMLElement>(root, '[data-vr-status]').textContent).toMatch(/discarded/i);
    expect(query<HTMLButtonElement>(root, '[data-vr-stop]').hidden).toBe(true);
    expect(runToolByIdMock).not.toHaveBeenCalled();
  });

  it('reports a browser without any audio API', () => {
    (globalThis as Record<string, unknown>).MediaRecorder = undefined;
    const root = fixture();
    mountVoiceRecorderPanel(root);
    expect(query<HTMLElement>(root, '[data-vr-error]').hidden).toBe(false);
    expect(query<HTMLElement>(root, '[data-vr-error]').textContent).toMatch(/cannot record audio/i);
  });
});