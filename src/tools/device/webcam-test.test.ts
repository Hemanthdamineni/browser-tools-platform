import { describe, it, expect, vi } from 'vitest';
import {
  videoConstraintsForOptions,
  readTrackSettings,
  formatReadout,
  listCameras,
  requestCamera,
  captureFrame,
  snapshotFilename,
  stopStream,
} from './webcam-test.core';
import { ToolError } from '@/lib/types';

describe('webcam-test core', () => {
  it('builds constraints from resolution and fps', () => {
    expect(videoConstraintsForOptions('1280x720', '30')).toEqual({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    });
  });

  it('auto leaves the choice to the camera', () => {
    expect(videoConstraintsForOptions('auto', 'auto')).toEqual({});
  });

  it('pins the device when one is picked', () => {
    expect(videoConstraintsForOptions('auto', 'auto', 'abc')).toEqual({
      deviceId: { exact: 'abc' },
    });
  });

  it('ignores malformed resolution strings', () => {
    expect(videoConstraintsForOptions('big', '30')).toEqual({ frameRate: { ideal: 30 } });
  });

  it('reads track settings with zeros for missing values', () => {
    expect(readTrackSettings(undefined)).toEqual({
      width: 0,
      height: 0,
      frameRate: 0,
      label: '',
    });
  });

  it('reads real track settings', () => {
    const track = {
      getSettings: () => ({ width: 1920, height: 1080, frameRate: 29.97, deviceId: 'x' }),
      label: 'FaceTime HD',
    } as unknown as MediaStreamTrack;
    expect(readTrackSettings(track)).toEqual({
      width: 1920,
      height: 1080,
      frameRate: 29.97,
      label: 'FaceTime HD',
    });
  });

  it('formats the readout line', () => {
    expect(formatReadout({ width: 1920, height: 1080, frameRate: 29.97, label: '' })).toBe(
      '1920 × 1080 @ 30 fps',
    );
    expect(formatReadout({ width: 0, height: 0, frameRate: 0, label: '' })).toBe('0 × 0 @ 0 fps');
  });

  it('lists only video inputs', async () => {
    const devices = [
      { kind: 'videoinput', deviceId: '1' },
      { kind: 'audioinput', deviceId: '2' },
      { kind: 'videoinput', deviceId: '3' },
    ] as unknown as MediaDeviceInfo[];
    const cameras = await listCameras({ enumerateDevices: async () => devices });
    expect(cameras).toHaveLength(2);
  });

  it('returns [] when enumerateDevices is missing', async () => {
    expect(await listCameras(undefined)).toEqual([]);
    expect(await listCameras(null)).toEqual([]);
    expect(await listCameras({})).toEqual([]);
  });

  it('returns [] when enumerateDevices rejects', async () => {
    const cameras = await listCameras({
      enumerateDevices: async () => {
        throw new Error('denied');
      },
    });
    expect(cameras).toEqual([]);
  });

  it('throws ToolError when getUserMedia is unavailable', async () => {
    await expect(requestCamera({}, undefined)).rejects.toThrow(ToolError);
  });

  it('returns the stream on success', async () => {
    const stream = { id: 's' } as unknown as MediaStream;
    const md = { getUserMedia: vi.fn(async () => stream) };
    await expect(requestCamera({}, md as never)).resolves.toBe(stream);
    expect(md.getUserMedia).toHaveBeenCalledWith({ video: {}, audio: false });
  });

  it('maps NotAllowedError to a friendly ToolError', async () => {
    const err = Object.assign(new Error('nope'), { name: 'NotAllowedError' });
    const md = {
      getUserMedia: vi.fn(async () => {
        throw err;
      }),
    };
    await expect(requestCamera({}, md as never)).rejects.toThrow(/permission was denied/);
  });

  it('maps NotReadableError to the in-use message', async () => {
    const err = Object.assign(new Error('busy'), { name: 'NotReadableError' });
    const md = {
      getUserMedia: vi.fn(async () => {
        throw err;
      }),
    };
    await expect(requestCamera({}, md as never)).rejects.toThrow(/already in use/);
  });

  it('maps OverconstrainedError to a friendly ToolError', async () => {
    const err = Object.assign(new Error('mode'), { name: 'OverconstrainedError' });
    const md = {
      getUserMedia: vi.fn(async () => {
        throw err;
      }),
    };
    await expect(requestCamera({}, md as never)).rejects.toThrow(
      /does not support the requested settings/,
    );
  });

  it('captureFrame encodes one frame and resets the canvas', async () => {
    const video = {} as HTMLVideoElement;
    const created: HTMLCanvasElement[] = [];
    const realCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'canvas') {
        created.push(el as HTMLCanvasElement);
        (el as HTMLCanvasElement).getContext = vi.fn(() => ({
          drawImage: vi.fn(),
        })) as unknown as CanvasRenderingContext2D;
      }
      return el;
    }) as typeof document.createElement);

    const blob = new Blob(['png'], { type: 'image/png' });
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(blob));

    const out = await captureFrame({ video, width: 320, height: 240 }, toBlob);
    expect(out).toBe(blob);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    const canvas = created[0]!;
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    createSpy.mockRestore();
  });

  it('captureFrame rejects when encoding fails', async () => {
    const realCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'canvas') {
        (el as HTMLCanvasElement).getContext = vi.fn(
          () => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D,
        );
      }
      return el;
    }) as typeof document.createElement);
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(null));
    await expect(
      captureFrame({ video: {} as HTMLVideoElement, width: 10, height: 10 }, toBlob),
    ).rejects.toThrow(ToolError);
    createSpy.mockRestore();
  });

  it('captureFrame throws when the canvas context is unavailable', async () => {
    const realCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'canvas') {
        (el as HTMLCanvasElement).getContext = vi.fn(() => null);
      }
      return el;
    }) as typeof document.createElement);
    await expect(
      captureFrame({ video: {} as HTMLVideoElement, width: 10, height: 10 }, () => undefined),
    ).rejects.toThrow(ToolError);
    createSpy.mockRestore();
  });

  it('snapshotFilename builds a timestamped png name', () => {
    const name = snapshotFilename(new Date('2026-10-27T12:30:05Z'));
    expect(name).toMatch(/^webcam-snapshot-2026-10-27-12-30-05\.png$/);
  });

  it('stopStream stops every track and tolerates null', () => {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }] as unknown as MediaStreamTrack[];
    const stream = { getTracks: () => tracks } as unknown as MediaStream;
    stopStream(stream);
    expect(tracks[0]!.stop).toHaveBeenCalled();
    expect(tracks[1]!.stop).toHaveBeenCalled();
    expect(() => stopStream(null)).not.toThrow();
  });
});
