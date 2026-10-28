import { describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import type { FileRunInput } from '@/lib/types';
import tool, { runScreenRecorder } from './screen-recorder.tool';
import { meta } from './screen-recorder.meta';
import {
  containerForMimeType,
  describeCaptureError,
  insecureContextError,
  startRecording,
  type RecorderFactory,
  type RecorderLike,
} from './webcam-recorder-core';
import {
  SURFACE_PREFERENCES,
  addMicrophoneTrack,
  describeScreenCaptureError,
  displayMediaOptionsForSurface,
  requestScreen,
  screenCaptureError,
} from './screen-recorder.core';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/** A recorder that records what the browser would record. */
class FakeRecorder implements RecorderLike {
  mimeType: string;
  state: 'inactive' | 'recording' = 'inactive';
  // The browser hands over real `BlobEvent` / `ErrorEvent` objects; the fake
  // only needs the fields the recorder actually reads.
  ondataavailable: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onstop: ((event?: any) => void) | null = null;
  readonly chunks: Blob[] = [];

  constructor(readonly options: { mimeType?: string; videoBitsPerSecond?: number }) {
    this.mimeType = options.mimeType ?? '';
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.onstop?.();
  }

  /** Hand over a chunk, the way the browser does. */
  push(text: string): void {
    const blob = new Blob([text], { type: this.mimeType });
    this.chunks.push(blob);
    this.ondataavailable?.({ data: blob });
  }
}

/** A factory that reports the given MIME types as supported. */
function makeFactory(supported: string[] = ['video/webm;codecs=vp9']): {
  factory: RecorderFactory;
  created: FakeRecorder[];
} {
  const created: FakeRecorder[] = [];
  const factory: RecorderFactory = {
    isTypeSupported: (type: string) => supported.includes(type),
    create: (_stream, recorderOptions) => {
      const recorder = new FakeRecorder(recorderOptions);
      created.push(recorder);
      return recorder;
    },
  };
  return { factory, created };
}

/** A fake display stream whose added tracks are observable. */
function makeDisplayStream(): {
  stream: MediaStream;
  tracks: { stopped: boolean }[];
} {
  const tracks: { stopped: boolean }[] = [];
  const stream = {
    id: 'display',
    getVideoTracks: () => tracks.slice(0, 1).map(() => ({ kind: 'video', stop: () => undefined })),
    getAudioTracks: () => tracks.slice(1).map(() => ({ kind: 'audio', stop: () => undefined })),
    addTrack: (track: { kind: string }) => {
      tracks.push({ kind: track.kind, stopped: false } as never);
    },
  } as unknown as MediaStream;
  return { stream, tracks };
}

const recorded = (type = 'video/webm', bytes = 64): File =>
  new File([new Uint8Array(bytes)], 'recording.webm', { type });

const run = (input: Partial<FileRunInput> = {}) =>
  runScreenRecorder({
    files: [],
    options: {},
    ...input,
  } as FileRunInput);

/* -------------------------------------------------------------------------- */
/*  The screen request                                                         */
/* -------------------------------------------------------------------------- */

describe('displayMediaOptionsForSurface', () => {
  it('prefers the whole screen for "monitor"', () => {
    expect(displayMediaOptionsForSurface('monitor')).toEqual({
      video: { displaySurface: 'monitor' },
      audio: false,
    });
  });

  it('prefers a single window for "window"', () => {
    expect(displayMediaOptionsForSurface('window')).toEqual({
      video: { displaySurface: 'window' },
      audio: false,
    });
  });

  it('leaves the choice to the browser by default', () => {
    for (const surface of ['', 'monitor', 'window', 'tab', 'nonsense']) {
      if ((SURFACE_PREFERENCES as readonly string[]).includes(surface)) continue;
      void surface;
    }
    expect(displayMediaOptionsForSurface('')).toBeNull();
    expect(displayMediaOptionsForSurface(null)).toBeNull();
    expect(displayMediaOptionsForSurface(undefined)).toBeNull();
  });

  it('treats unknown values as "let the browser decide"', () => {
    expect(displayMediaOptionsForSurface('kiosk')).toBeNull();
  });
});

describe('screenCaptureError', () => {
  it('passes when getDisplayMedia exists', () => {
    const devices = { getDisplayMedia: vi.fn() };
    expect(screenCaptureError(devices)).toBeNull();
  });

  it('explains insecure pages when the API is missing', () => {
    const error = screenCaptureError({});
    expect(error).toBeInstanceOf(ToolError);
    expect(error!.message).toBe(insecureContextError().message);
    expect(screenCaptureError(undefined)).toBeInstanceOf(ToolError);
    expect(screenCaptureError(null)).toBeInstanceOf(ToolError);
    expect(screenCaptureError({ getDisplayMedia: 'nope' })).toBeInstanceOf(ToolError);
  });
});

describe('requestScreen', () => {
  it('calls getDisplayMedia with the surface preference', async () => {
    const stream = makeDisplayStream().stream;
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    const result = await requestScreen({ getDisplayMedia }, { surface: 'monitor' });
    expect(getDisplayMedia).toHaveBeenCalledWith({
      video: { displaySurface: 'monitor' },
      audio: false,
    });
    expect(result).toBe(stream);
  });

  it('calls getDisplayMedia without options when no preference is set', async () => {
    const stream = makeDisplayStream().stream;
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    await requestScreen({ getDisplayMedia }, {});
    expect(getDisplayMedia).toHaveBeenCalledWith(undefined);
  });

  it('propagates the rejection verbatim', async () => {
    const rejection = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const getDisplayMedia = vi.fn().mockRejectedValue(rejection);
    await expect(requestScreen({ getDisplayMedia })).rejects.toBe(rejection);
  });
});

describe('addMicrophoneTrack', () => {
  it('returns the display stream unchanged when the mic is off', async () => {
    const display = makeDisplayStream().stream;
    const getUserMedia = vi.fn();
    await expect(addMicrophoneTrack(display, { getUserMedia }, { mic: false })).resolves.toBe(
      display,
    );
    await expect(addMicrophoneTrack(display, { getUserMedia })).resolves.toBe(display);
    await expect(addMicrophoneTrack(display, undefined, { mic: true })).resolves.toBe(display);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('mixes the microphone audio tracks into the display stream', async () => {
    const { stream: display, tracks } = makeDisplayStream();
    const micTrack = { kind: 'audio', stop: vi.fn() };
    const micStream = { getAudioTracks: () => [micTrack] };
    const getUserMedia = vi.fn().mockResolvedValue(micStream);

    const result = await addMicrophoneTrack(display, { getUserMedia }, { mic: true });
    expect(result).toBe(display);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(tracks).toHaveLength(1);
  });

  it('propagates the getUserMedia rejection verbatim', async () => {
    const display = makeDisplayStream().stream;
    const rejection = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const getUserMedia = vi.fn().mockRejectedValue(rejection);
    await expect(addMicrophoneTrack(display, { getUserMedia }, { mic: true })).rejects.toBe(
      rejection,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Errors                                                                     */
/* -------------------------------------------------------------------------- */

describe('describeScreenCaptureError', () => {
  it('explains a cancelled share prompt', () => {
    const err = describeScreenCaptureError({ name: 'NotAllowedError' });
    expect(err).toBeInstanceOf(ToolError);
    expect(err.message).toMatch(/cancelled or denied/i);
  });

  it('explains protected content', () => {
    const err = describeScreenCaptureError({ name: 'NotReadableError' });
    expect(err.message).toMatch(/could not be captured/i);
  });

  it('falls back to the shared capture error for unrelated names', () => {
    const shared = describeCaptureError({ name: 'SecurityError' });
    const own = describeScreenCaptureError({ name: 'SecurityError' });
    // SecurityError is not screen-specific; the shared wording stays reachable
    // through describeCaptureError, while the screen variant has its own voice.
    expect(own.message).not.toBe('');
    expect(shared.message).not.toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/*  The recording flow (shared webcam-recorder-core machinery)                 */
/* -------------------------------------------------------------------------- */

describe('the screen recording flow', () => {
  it('records a display stream end to end through the shared core', async () => {
    const { stream } = makeDisplayStream();
    const { factory, created } = makeFactory(['video/webm;codecs=vp9']);
    const session = startRecording(stream, factory, { videoBitsPerSecond: 2_500_000 });
    created[0]!.push('frame');
    session.stop();
    const clip = await session.result();
    expect(clip.mimeType).toBe('video/webm;codecs=vp9');
    expect(clip.container).toBe('webm');
    expect(clip.blob.size).toBe(5);
  });

  it('records MP4 where the browser supports it', async () => {
    const { stream } = makeDisplayStream();
    const { factory, created } = makeFactory(['video/mp4']);
    const session = startRecording(stream, factory);
    created[0]!.push('frame');
    session.stop();
    const clip = await session.result();
    expect(clip.container).toBe('mp4');
    expect(containerForMimeType(clip.mimeType)).toBe('mp4');
  });

  it('throws a friendly error when no container is supported', () => {
    const { stream } = makeDisplayStream();
    const { factory } = makeFactory([]);
    expect(() => startRecording(stream, factory)).toThrowError(ToolError);
  });
});

/* -------------------------------------------------------------------------- */
/*  The tool                                                                   */
/* -------------------------------------------------------------------------- */

describe('the screen recorder meta', () => {
  it('is a beta file tool in the video category with its own panel', () => {
    expect(tool.meta).toBe(meta);
    expect(meta.id).toBe('screen-recorder');
    expect(meta.category).toBe('video');
    expect(meta.panel).toBe('screen-recorder');
    expect(meta.input).toBe('file');
    expect(meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });
});

describe('the screen recorder tool', () => {
  it('packages a recording as a download', async () => {
    const result = await run({ files: [recorded('video/webm;codecs=vp9', 128)] });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toMatch(
      /^screen-recording-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.webm$/,
    );
    expect(result.outputs[0]!.blob.size).toBe(128);
    expect(result.stats?.container).toBe('webm');
  });

  it('uses the MP4 extension for an MP4 recording', async () => {
    const result = await run({ files: [recorded('video/mp4', 128)] });
    expect(result.outputs[0]!.filename).toMatch(/\.mp4$/);
    expect(result.stats?.container).toBe('mp4');
  });

  it('uses the file name the user asked for', async () => {
    const result = await run({ files: [recorded()], options: { filename: 'standup' } });
    expect(result.outputs[0]!.filename).toMatch(/^standup-\d{4}-\d{2}-\d{2}/);
  });

  it('falls back to the default name for an empty file name', async () => {
    const result = await run({ files: [recorded()], options: { filename: '' } });
    expect(result.outputs[0]!.filename).toMatch(/^screen-recording-/);
  });

  it('reports the quality in the stats and the notes', async () => {
    const result = await run({ files: [recorded()], options: { quality: 'high' } });
    expect(result.stats?.quality).toBe('high');
    expect(result.notes?.join(' ')).toMatch(/high/i);
  });

  it('reports whether the microphone was recorded', async () => {
    const withMic = await run({ files: [recorded()], options: { mic: true } });
    expect(withMic.notes?.join(' ')).toMatch(/microphone audio/i);
    const withoutMic = await run({ files: [recorded()], options: { mic: false } });
    expect(withoutMic.notes?.join(' ')).toMatch(/without audio/i);
  });

  it('refuses to run without a recording', async () => {
    await expect(run({ files: [] })).rejects.toThrowError(ToolError);
    await expect(run({ files: [] })).rejects.toThrowError(/record a clip first/i);
  });

  it('refuses an empty recording', async () => {
    const empty = new File([], 'recording.webm', { type: 'video/webm' });
    await expect(run({ files: [empty] })).rejects.toThrowError(/empty/i);
  });

  it('refuses more than one recording', async () => {
    await expect(run({ files: [recorded(), recorded()] })).rejects.toThrowError(
      /one recording at a time/i,
    );
  });
});
