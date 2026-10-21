import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountScreenRecorderPanel } from './screen-recorder-panel';
import { runToolById } from '@/lib/worker/client';
import { formatElapsed, pickMimeType } from '@/tools/video/screen-recorder.core';

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                      */
/* -------------------------------------------------------------------------- */

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({
  runToolById: vi.fn(),
}));

const runToolByIdMock = vi.mocked(runToolById);

/* -------------------------------------------------------------------------- */
/*  Fake browser APIs                                                          */
/* -------------------------------------------------------------------------- */

class FakeTrack {
  stopped = false;
  private listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(readonly kind: 'video' | 'audio') {}

  stop(): void {
    this.stopped = true;
  }

  addEventListener(type: string, fn: (event: Event) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: (event: Event) => void): void {
    this.listeners.get(type)?.delete(fn);
  }

  dispatchEvent(event: Event): boolean {
    this.listeners.get(event.type)?.forEach((fn) => fn(event));
    return true;
  }

  getSettings(): Record<string, unknown> {
    return {};
  }
}

class FakeStream {
  constructor(private readonly tracks: FakeTrack[] = []) {}

  getTracks(): FakeTrack[] {
    return this.tracks;
  }

  getVideoTracks(): FakeTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
}

class FakeMediaRecorder {
  /** The MIME types this fake browser can record. */
  static supported = new Set<string>(['video/webm;codecs=vp9,opus', 'video/webm']);
  static instances: FakeMediaRecorder[] = [];

  state: 'inactive' | 'recording' = 'inactive';
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

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}

interface Devices {
  getDisplayMedia: (constraints?: MediaStreamConstraints) => Promise<FakeStream>;
  getUserMedia: (constraints?: MediaStreamConstraints) => Promise<FakeStream>;
}

function installDevices(devices: Partial<Devices>): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: devices as unknown as MediaDevices,
    configurable: true,
  });
}

/** A display stream with one video track. */
function displayStream(): FakeStream {
  return new FakeStream([new FakeTrack('video')]);
}

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The markup ScreenRecorderPanel.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.fileWorkbench = '';
  root.dataset.screenRecorderWorkbench = '';
  root.dataset.toolId = 'screen-recorder';
  root.innerHTML = `
    <button type="button" data-share aria-pressed="false"><span data-share-label>Share screen</span></button>
    <button type="button" data-mic aria-pressed="false"><span>Microphone</span></button>
    <span data-mic-state>off</span>
    <select data-format><option value="webm">WebM</option></select>
    <select data-quality><option value="5000000" selected>5 Mbps</option></select>
    <button type="button" data-start disabled>Start recording</button>
    <button type="button" data-stop hidden>Stop recording</button>
    <span data-rec-dot hidden></span>
    <span data-timer role="timer">0:00</span>
    <p data-status role="status"></p>
    <div data-error hidden></div>
    <div data-preview-wrap hidden><video data-preview></video></div>
    <div data-clip-wrap hidden><video data-clip controls></video></div>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg></p></div>
    <div data-result-wrap hidden>
      <div data-report hidden></div>
      <ul data-outputs></ul>
      <ul data-notes></ul>
    </div>
  `;
  document.body.append(root);
  return root;
}

const query = <T extends Element>(root: HTMLElement, selector: string): T =>
  root.querySelector<T>(selector)!;

/* -------------------------------------------------------------------------- */
/*  Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

let originalMediaRecorder: unknown;
let originalMediaStream: unknown;
let originalPlay: unknown;
const originalRecorderStop = FakeMediaRecorder.prototype.stop;

beforeEach(() => {
  originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;
  originalMediaStream = (globalThis as Record<string, unknown>).MediaStream;
  originalPlay = HTMLMediaElement.prototype.play;
  (globalThis as Record<string, unknown>).MediaRecorder = FakeMediaRecorder;
  (globalThis as Record<string, unknown>).MediaStream = FakeStream;
  // jsdom has no media pipeline — the preview playback is a nicety.
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined) as never;
  FakeMediaRecorder.prototype.stop = originalRecorderStop;
  FakeMediaRecorder.supported = new Set(['video/webm;codecs=vp9,opus', 'video/webm']);
  FakeMediaRecorder.instances = [];
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({
    outputs: [{ filename: 'screen-recording.webm', blob: new Blob(['video']) }],
    report: { output: JSON.stringify({ headers: ['Property'], rows: [] }), render: 'table' },
  } as never);
});

afterEach(() => {
  (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
  (globalThis as Record<string, unknown>).MediaStream = originalMediaStream;
  HTMLMediaElement.prototype.play = originalPlay as never;
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('screen recorder helpers', () => {
  it('formats the elapsed timer', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_000)).toBe('1:05');
  });

  it('picks the MIME type the browser can actually record', () => {
    expect(pickMimeType((t) => t === 'video/webm')).toBe('video/webm');
    expect(pickMimeType(() => false)).toBeNull();
  });
});

describe('mountScreenRecorderPanel', () => {
  it('lists MP4 only when the browser can record it', () => {
    const root = fixture();
    mountScreenRecorderPanel(root);

    const options = Array.from(query<HTMLSelectElement>(root, '[data-format]').options).map(
      (o) => o.value,
    );
    expect(options).toEqual(['webm']);
    // WebM is the default.
    expect(query<HTMLSelectElement>(root, '[data-format]').value).toBe('webm');

    FakeMediaRecorder.supported = new Set(['video/webm;codecs=vp9,opus', 'video/mp4;codecs=avc1']);
    const second = fixture();
    mountScreenRecorderPanel(second);
    const withMp4 = Array.from(query<HTMLSelectElement>(second, '[data-format]').options).map(
      (o) => o.value,
    );
    expect(withMp4).toEqual(['webm', 'mp4']);
  });

  it('shares the screen and enables the recorder', async () => {
    installDevices({ getDisplayMedia: async () => displayStream() });
    const root = fixture();
    mountScreenRecorderPanel(root);

    expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(true);

    query<HTMLButtonElement>(root, '[data-share]').click();

    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(false);
    });
    expect(query<HTMLButtonElement>(root, '[data-share]').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(query<HTMLElement>(root, '[data-share-label]').textContent).toBe('Stop sharing');
    expect(query<HTMLElement>(root, '[data-status]').textContent).toMatch(/shared/i);
    expect(query<HTMLElement>(root, '[data-error]').hidden).toBe(true);
  });

  it('explains a denied screen prompt instead of crashing', async () => {
    installDevices({
      getDisplayMedia: async () => {
        throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      },
    });
    const root = fixture();
    mountScreenRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-share]').click();

    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-error]').hidden).toBe(false);
    });
    expect(query<HTMLElement>(root, '[data-error]').textContent).toMatch(/denied/i);
    expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(true);
  });

  it('explains a browser without screen sharing', async () => {
    installDevices({});
    const root = fixture();
    mountScreenRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-share]').click();

    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-error]').hidden).toBe(false);
    });
    expect(query<HTMLElement>(root, '[data-error]').textContent).toMatch(/cannot share a screen/i);
  });

  it('explains a browser without a recorder', () => {
    (globalThis as Record<string, unknown>).MediaRecorder = undefined;
    installDevices({ getDisplayMedia: async () => displayStream() });
    const root = fixture();
    mountScreenRecorderPanel(root);

    expect(query<HTMLElement>(root, '[data-error]').hidden).toBe(false);
    expect(query<HTMLElement>(root, '[data-error]').textContent).toMatch(/cannot record video/i);
  });

  it('switches the microphone on and off', async () => {
    const mic = new FakeStream([new FakeTrack('audio')]);
    installDevices({ getDisplayMedia: async () => displayStream(), getUserMedia: async () => mic });
    const root = fixture();
    mountScreenRecorderPanel(root);

    expect(query<HTMLElement>(root, '[data-mic-state]').textContent).toBe('off');
    query<HTMLButtonElement>(root, '[data-mic]').click();

    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-mic]').getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
    expect(query<HTMLElement>(root, '[data-mic-state]').textContent).toBe('on');

    query<HTMLButtonElement>(root, '[data-mic]').click();
    expect(query<HTMLElement>(root, '[data-mic-state]').textContent).toBe('off');
    expect(mic.getAudioTracks()[0]!.stopped).toBe(true);
  });

  it('explains a denied microphone', async () => {
    installDevices({
      getDisplayMedia: async () => displayStream(),
      getUserMedia: async () => {
        throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      },
    });
    const root = fixture();
    mountScreenRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-mic]').click();

    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-error]').hidden).toBe(false);
    });
    expect(query<HTMLElement>(root, '[data-error]').textContent).toMatch(/microphone permission/i);
    expect(query<HTMLElement>(root, '[data-mic-state]').textContent).toBe('off');
  });

  it('records, stops and hands the recording to the tool', async () => {
    installDevices({
      getDisplayMedia: async () => displayStream(),
      getUserMedia: async () => new FakeStream([new FakeTrack('audio')]),
    });
    const root = fixture();
    mountScreenRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-share]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(false);
    });

    // The microphone is on, so it is part of the recording.
    query<HTMLButtonElement>(root, '[data-mic]').click();
    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-mic-state]').textContent).toBe('on');
    });

    query<HTMLButtonElement>(root, '[data-start]').click();
    expect(query<HTMLButtonElement>(root, '[data-stop]').hidden).toBe(false);
    expect(query<HTMLElement>(root, '[data-rec-dot]').hidden).toBe(false);
    expect(query<HTMLElement>(root, '[data-status]').textContent).toMatch(/recording started/i);
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0]!.mimeType).toBe('video/webm;codecs=vp9,opus');

    query<HTMLButtonElement>(root, '[data-stop]').click();

    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    });

    const [toolId, payload] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('screen-recorder');
    expect(payload.files).toHaveLength(1);
    const recorded = (payload.files as File[])[0]!;
    expect(recorded.name).toMatch(/^screen-recording-\d{8}-\d{6}\.webm$/);
    expect(recorded.type).toBe('video/webm;codecs=vp9,opus');
    expect(recorded.size).toBe(4);
    expect(payload.options).toMatchObject({ format: 'webm', microphone: true });

    // The result is shown with a download button.
    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-result-wrap]').hidden).toBe(false);
    });
    const save = query<HTMLButtonElement>(root, '[data-outputs] button');
    expect(save.textContent).toBe('Save');
    expect(query<HTMLElement>(root, '[data-status]').textContent).toMatch(/recording stopped/i);
    expect(query<HTMLButtonElement>(root, '[data-stop]').hidden).toBe(true);
  });

  it('stops the recording when the browser ends the share', async () => {
    const stream = displayStream();
    installDevices({ getDisplayMedia: async () => stream });
    const root = fixture();
    mountScreenRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-share]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(false);
    });
    query<HTMLButtonElement>(root, '[data-start]').click();

    // The user pressed the browser's own "Stop sharing" button.
    stream.getVideoTracks()[0]!.dispatchEvent(new Event('ended'));

    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    });
    // The recording is finalised instead of being left half-written.
    expect(query<HTMLElement>(root, '[data-status]').textContent).toMatch(/recording stopped/i);
    // The dead share is gone, so no new recording can be started from it.
    expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(true);
    expect(query<HTMLButtonElement>(root, '[data-share]').getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('drops the share when the browser ends it while nothing is recording', async () => {
    const stream = displayStream();
    installDevices({ getDisplayMedia: async () => stream });
    const root = fixture();
    mountScreenRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-share]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(false);
    });

    stream.getVideoTracks()[0]!.dispatchEvent(new Event('ended'));

    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(true);
    });
    expect(query<HTMLElement>(root, '[data-share-label]').textContent).toBe('Share screen');
    expect(runToolByIdMock).not.toHaveBeenCalled();
  });

  it('reports an empty recording instead of pretending it worked', async () => {
    installDevices({ getDisplayMedia: async () => displayStream() });
    const root = fixture();
    mountScreenRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-share]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(false);
    });

    // A recorder that never produces a chunk.
    FakeMediaRecorder.prototype.stop = function stop(this: FakeMediaRecorder) {
      this.state = 'inactive';
      this.onstop?.();
    };
    query<HTMLButtonElement>(root, '[data-start]').click();
    query<HTMLButtonElement>(root, '[data-stop]').click();

    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-error]').hidden).toBe(false);
    });
    expect(query<HTMLElement>(root, '[data-error]').textContent).toMatch(/empty/i);
    expect(runToolByIdMock).not.toHaveBeenCalled();
  });

  it('shows the error the tool reported', async () => {
    runToolByIdMock.mockRejectedValue(
      Object.assign(new Error('The recording is empty (0 bytes).'), {
        name: 'Error',
        hint: 'Record again.',
      }),
    );
    installDevices({ getDisplayMedia: async () => displayStream() });
    const root = fixture();
    mountScreenRecorderPanel(root);

    query<HTMLButtonElement>(root, '[data-share]').click();
    await vi.waitFor(() => {
      expect(query<HTMLButtonElement>(root, '[data-start]').disabled).toBe(false);
    });
    query<HTMLButtonElement>(root, '[data-start]').click();
    query<HTMLButtonElement>(root, '[data-stop]').click();

    await vi.waitFor(() => {
      expect(query<HTMLElement>(root, '[data-error]').hidden).toBe(false);
    });
    expect(query<HTMLElement>(root, '[data-error]').textContent).toMatch(/0 bytes/);
    expect(query<HTMLElement>(root, '[data-error]').textContent).toMatch(/Record again/);
  });
});
