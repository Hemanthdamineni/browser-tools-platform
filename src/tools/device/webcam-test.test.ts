import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './webcam-test.tool';
import {
  assertHasDevices,
  assertSnapshotDimensions,
  buildReportNotes,
  buildReportRows,
  describeCameraError,
  facingLabel,
  formatAspectRatio,
  formatFps,
  formatResolution,
  fpsFromTimestamps,
  parseCaptureProbe,
  readImageDimensions,
  sameResolution,
  snapshotFilename,
  trimFrameWindow,
  type CameraDevice,
  type CaptureProbe,
  type SnapshotInfo,
} from './webcam-test.core';
import { encodePng, makePngFile } from '../../../test/signature-fakes';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

function sampleCapture(overrides: Partial<CaptureProbe> = {}): CaptureProbe {
  return {
    deviceId: 'camera-1',
    deviceLabel: 'HD Webcam',
    settings: { width: 1280, height: 720, frameRate: 30, aspectRatio: 1.777, facingMode: 'user' },
    fps: 29.9,
    frames: 60,
    sampleMs: 1973,
    fpsSource: 'video-frame',
    devices: [
      { deviceId: 'camera-1', label: 'HD Webcam', active: true },
      { deviceId: 'camera-2', label: 'IR Camera', active: false },
    ],
    ...overrides,
  };
}

function sampleSnapshot(overrides: Partial<SnapshotInfo> = {}): SnapshotInfo {
  return { width: 1280, height: 720, format: 'png', bytes: 84_321, ...overrides };
}

/** The `options.capture` string a working panel hands over. */
function probeJson(overrides: Partial<CaptureProbe> = {}): string {
  return JSON.stringify(sampleCapture(overrides));
}

/** SOI + an empty APP0 + SOF0 + EOI: a JPEG whose header declares its size. */
function jpegBytes(width: number, height: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    0xff,
    0xd8, // SOI
    0xff,
    0xe0,
    0x00,
    0x02, // APP0, empty payload
    0xff,
    0xc0,
    0x00,
    0x0b, // SOF0, length 11 (one component)
    0x08, // sample precision
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01, // component count
    0x01,
    0x11,
    0x00, // component spec
    0xff,
    0xd9, // EOI
  ]);
}

/* -------------------------------------------------------------------------- */
/*  Resolution / fps formatting                                               */
/* -------------------------------------------------------------------------- */

describe('formatResolution', () => {
  it('formats a known size', () => {
    expect(formatResolution(1280, 720)).toBe('1280 × 720');
  });

  it('rounds fractional sizes from track settings', () => {
    expect(formatResolution(640.4, 480.9)).toBe('640 × 481');
  });

  it('reports unknown for missing, zero or negative sizes', () => {
    expect(formatResolution(null, null)).toBe('unknown');
    expect(formatResolution(0, 720)).toBe('unknown');
    expect(formatResolution(1280, undefined)).toBe('unknown');
    expect(formatResolution(-5, 720)).toBe('unknown');
  });
});

describe('formatFps', () => {
  it('formats a rate with one decimal', () => {
    expect(formatFps(29.933)).toBe('29.9 fps');
  });

  it('reports unknown for missing, zero or negative rates', () => {
    expect(formatFps(null)).toBe('unknown');
    expect(formatFps(0)).toBe('unknown');
    expect(formatFps(-1)).toBe('unknown');
  });
});

describe('formatAspectRatio', () => {
  it('reduces common ratios to whole numbers', () => {
    expect(formatAspectRatio(1280, 720)).toBe('16:9');
    expect(formatAspectRatio(640, 480)).toBe('4:3');
    expect(formatAspectRatio(1920, 1080)).toBe('16:9');
  });

  it('falls back to a decimal ratio when the reduced form is unwieldy', () => {
    expect(formatAspectRatio(1919, 1080)).toBe('1.78:1');
  });

  it('returns null without a usable size', () => {
    expect(formatAspectRatio(null, null)).toBeNull();
    expect(formatAspectRatio(0, 720)).toBeNull();
  });
});

describe('facingLabel', () => {
  it('maps the standard modes and passes through unknown values', () => {
    expect(facingLabel('user')).toBe('Front (user-facing)');
    expect(facingLabel('environment')).toBe('Rear (environment-facing)');
    expect(facingLabel('left')).toBe('Left side');
    expect(facingLabel('experimental')).toBe('experimental');
    expect(facingLabel(null)).toBeNull();
    expect(facingLabel('')).toBeNull();
  });
});

describe('fpsFromTimestamps', () => {
  it('measures fps from presented-frame timestamps', () => {
    // 60 frames over 2 seconds => (60 - 1) * 1000 / 2000 = 29.5
    const stamps = Array.from({ length: 60 }, (_, i) => i * (2000 / 59));
    expect(fpsFromTimestamps(stamps)).toBe(29.5);
  });

  it('returns null with fewer than two frames', () => {
    expect(fpsFromTimestamps([])).toBeNull();
    expect(fpsFromTimestamps([100])).toBeNull();
  });

  it('returns null when the window has no positive span', () => {
    expect(fpsFromTimestamps([100, 100])).toBeNull();
  });

  it('handles a single gap (two frames, one second apart)', () => {
    expect(fpsFromTimestamps([0, 1000])).toBe(1);
  });
});

describe('trimFrameWindow', () => {
  it('keeps the array reference when nothing has aged out', () => {
    const stamps = [1000, 1100, 1200];
    const now = 1250;
    expect(trimFrameWindow(stamps, now, 2000)).toBe(stamps);
  });

  it('drops timestamps older than the window', () => {
    const stamps = [0, 500, 1000, 1500];
    // A 2000 ms window keeps everything at or above `now - 2000 = 200`.
    const kept = trimFrameWindow(stamps, 2200, 2000);
    expect(kept).toEqual([500, 1000, 1500]);
  });

  it('trims to a new array only when it must', () => {
    const stamps = [100, 200, 300];
    const kept = trimFrameWindow(stamps, 250, 100);
    expect(kept).not.toBe(stamps);
    expect(kept).toEqual([200, 300]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Probe parsing                                                             */
/* -------------------------------------------------------------------------- */

describe('parseCaptureProbe', () => {
  it('parses a full capture probe from JSON', () => {
    const probe = parseCaptureProbe(probeJson());
    expect(probe.deviceId).toBe('camera-1');
    expect(probe.deviceLabel).toBe('HD Webcam');
    expect(probe.settings).toEqual({
      width: 1280,
      height: 720,
      frameRate: 30,
      aspectRatio: 1.777,
      facingMode: 'user',
    });
    expect(probe.fps).toBe(29.9);
    expect(probe.frames).toBe(60);
    expect(probe.sampleMs).toBe(1973);
    expect(probe.fpsSource).toBe('video-frame');
    expect(probe.devices).toHaveLength(2);
  });

  it('returns an empty probe for a missing value', () => {
    const probe = parseCaptureProbe(undefined);
    expect(probe.deviceId).toBe('');
    expect(probe.settings.width).toBeNull();
    expect(probe.fps).toBeNull();
    expect(probe.devices).toBeNull();
    expect(probe.frames).toBe(0);
  });

  it('accepts a null camera list and a raf fallback source', () => {
    const probe = parseCaptureProbe(
      JSON.stringify(sampleCapture({ fpsSource: 'raf', devices: null })),
    );
    expect(probe.fpsSource).toBe('raf');
    expect(probe.devices).toBeNull();
  });

  it('throws a ToolError for malformed JSON', () => {
    try {
      parseCaptureProbe('{not json');
      expect.unreachable('expected a ToolError');
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).message).toMatch(/valid JSON/i);
    }
  });

  it('throws for a non-object capture', () => {
    expect(() => parseCaptureProbe('"just a string"')).toThrow(/malformed/i);
  });

  it('throws when a settings field has the wrong type', () => {
    const bad = JSON.stringify({ ...sampleCapture(), settings: { width: '1280' } });
    expect(() => parseCaptureProbe(bad)).toThrow(/malformed \(width\)/i);
  });

  it('throws for a negative or fractional frame count', () => {
    const bad = JSON.stringify(sampleCapture({ frames: -1 }));
    expect(() => parseCaptureProbe(bad)).toThrow(/malformed/i);
    const fractional = JSON.stringify(sampleCapture({ frames: 1.5 }));
    expect(() => parseCaptureProbe(fractional)).toThrow(/malformed/i);
  });

  it('throws for a device list that is not an array of objects', () => {
    expect(() =>
      parseCaptureProbe(JSON.stringify({ ...sampleCapture(), devices: ['nope'] })),
    ).toThrow(/malformed/i);
  });

  it('throws for an unknown fpsSource', () => {
    const bad = JSON.stringify(sampleCapture({ fpsSource: 'setInterval' as never }));
    expect(() => parseCaptureProbe(bad)).toThrow(/malformed \(fpsSource\)/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Snapshot handling                                                         */
/* -------------------------------------------------------------------------- */

describe('readImageDimensions', () => {
  it('reads a PNG header without decoding', () => {
    const png = encodePng(new Uint8ClampedArray(320 * 180 * 4), 320, 180);
    expect(readImageDimensions(png)).toEqual({ width: 320, height: 180, format: 'png' });
  });

  it('rejects a non-image buffer', () => {
    expect(readImageDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('rejects a truncated PNG', () => {
    const png = encodePng(new Uint8ClampedArray(16), 4, 4);
    expect(readImageDimensions(png.subarray(0, 18))).toBeNull();
  });

  it('reads a JPEG from its SOF marker', () => {
    expect(readImageDimensions(jpegBytes(1024, 768))).toEqual({
      width: 1024,
      height: 768,
      format: 'jpeg',
    });
  });
});

describe('assertSnapshotDimensions', () => {
  it('accepts a sane frame', () => {
    expect(() => assertSnapshotDimensions(1920, 1080)).not.toThrow();
  });

  it('rejects non-positive sizes', () => {
    expect(() => assertSnapshotDimensions(0, 720)).toThrow(/no readable size/i);
    expect(() => assertSnapshotDimensions(-1, 720)).toThrow(/no readable size/i);
    expect(() => assertSnapshotDimensions(1.5, 720)).toThrow(/no readable size/i);
  });

  it('rejects a frame with an absurd edge', () => {
    expect(() => assertSnapshotDimensions(20_000, 10)).toThrow(/larger than this tool supports/i);
  });

  it('rejects a frame that exceeds the pixel budget', () => {
    // 8k x 8k = 67M pixels > 40M budget, but each edge is under the per-side cap.
    expect(() => assertSnapshotDimensions(8192, 8192)).toThrow(/67108864 pixels/i);
  });
});

describe('sameResolution', () => {
  it('is true when the stream and frame agree', () => {
    expect(sameResolution(1280, 720, 1280, 720)).toBe(true);
  });

  it('is true when the stream size is unknown (nothing to compare)', () => {
    expect(sameResolution(null, null, 1280, 720)).toBe(true);
  });

  it('is false when the frame does not match the live stream', () => {
    expect(sameResolution(1280, 720, 1920, 1080)).toBe(false);
  });
});

describe('snapshotFilename', () => {
  it('builds a slug, date-stamped filename', () => {
    const name = snapshotFilename('HD Webcam', new Date(2026, 9, 24, 9, 30, 5));
    expect(name).toMatch(/^hd-webcam-webcam-snapshot-20261024-093005\.png$/);
  });

  it('strips non-ASCII and keeps a sensible fallback', () => {
    expect(snapshotFilename('Cámara 你好', new Date(2026, 0, 1, 0, 0, 0))).toMatch(
      /^camara-webcam-snapshot-/,
    );
  });

  it('respects a JPEG extension', () => {
    expect(snapshotFilename('cam', new Date(2026, 0, 1), 'jpeg')).toMatch(/\.jpeg$/);
  });
});

/* -------------------------------------------------------------------------- */
/*  Report                                                                    */
/* -------------------------------------------------------------------------- */

describe('buildReportRows', () => {
  it('includes the live resolution, measured fps, snapshot and camera list', () => {
    const rows = buildReportRows(sampleCapture(), sampleSnapshot());
    const flat = rows.map((row) => row.join('|')).join('\n');
    expect(flat).toContain('Camera|HD Webcam');
    expect(flat).toContain('Live resolution|1280 × 720');
    expect(flat).toContain('Aspect ratio|16:9');
    expect(flat).toContain('Frame rate reported by the camera|30.0 fps');
    expect(flat).toContain('Measured frame rate|29.9 fps (60 frames over 1.97 s)');
    expect(flat).toContain('Facing|Front (user-facing)');
    expect(flat).toContain('Snapshot|1280 × 720 PNG · 82.34 KB');
    expect(flat).toContain('Cameras detected|2');
    expect(flat).toContain('HD Webcam — in use');
  });

  it('skips the reported frame rate when the camera does not expose one', () => {
    const probe = sampleCapture({ settings: { ...sampleCapture().settings, frameRate: null } });
    const flat = buildReportRows(probe, sampleSnapshot())
      .map((row) => row.join('|'))
      .join('\n');
    expect(flat).not.toContain('reported by the camera');
  });

  it('says the measured rate was not measured with fewer than two frames', () => {
    const probe = sampleCapture({ fps: null, frames: 1 });
    const flat = buildReportRows(probe, sampleSnapshot())
      .map((row) => row.join('|'))
      .join('\n');
    expect(flat).toContain('Measured frame rate|not measured');
  });
});

describe('buildReportNotes', () => {
  it('warns when the stream and snapshot resolutions differ', () => {
    const { warnings } = buildReportNotes(sampleCapture(), sampleSnapshot({ width: 1920, height: 1080 }));
    expect(warnings.join(' ')).toMatch(/captured frame is 1920 × 1080/i);
  });

  it('does not warn when they match', () => {
    expect(buildReportNotes(sampleCapture(), sampleSnapshot()).warnings).toEqual([]);
  });

  it('explains a raf-sampled frame rate', () => {
    const { notes } = buildReportNotes(sampleCapture({ fpsSource: 'raf' }), sampleSnapshot());
    expect(notes.join(' ')).toMatch(/display refresh loop/i);
  });

  it('notes the absence of live readings', () => {
    const { notes } = buildReportNotes(
      sampleCapture({ deviceId: '', devices: null }),
      sampleSnapshot(),
    );
    expect(notes.join(' ')).toMatch(/only describes the snapshot/i);
  });

  it('always notes that nothing was uploaded', () => {
    expect(buildReportNotes(sampleCapture(), sampleSnapshot()).notes.join(' ')).toMatch(
      /nothing was recorded or uploaded/i,
    );
  });
});

describe('assertHasDevices', () => {
  it('passes when at least one camera exists', () => {
    expect(() =>
      assertHasDevices([{ deviceId: 'a', label: 'Cam', active: true }] satisfies CameraDevice[]),
    ).not.toThrow();
  });

  it('throws a friendly ToolError when no camera exists', () => {
    try {
      assertHasDevices([]);
      expect.unreachable('expected a ToolError');
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).message).toMatch(/No camera was found/i);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Camera errors                                                             */
/* -------------------------------------------------------------------------- */

describe('describeCameraError', () => {
  it('maps a permission denial', () => {
    const error = describeCameraError({ name: 'NotAllowedError' });
    expect(error.message).toMatch(/permission was denied/i);
  });

  it('maps a missing camera', () => {
    expect(describeCameraError({ name: 'NotFoundError' }).message).toMatch(/No camera/i);
  });

  it('maps a camera already in use', () => {
    expect(describeCameraError({ name: 'NotReadableError' }).message).toMatch(/already in use/i);
  });

  it('maps an over-constrained request', () => {
    expect(describeCameraError({ name: 'OverconstrainedError' }).message).toMatch(
      /does not support/i,
    );
  });

  it('maps a security block', () => {
    expect(describeCameraError({ name: 'SecurityError' }).message).toMatch(/blocked on this page/i);
  });

  it('maps a missing API', () => {
    expect(describeCameraError({ name: 'TypeError' }).message).toMatch(/does not expose/i);
  });

  it('falls back to the raw message', () => {
    expect(describeCameraError(new Error('boom')).message).toMatch(/boom/);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool run()                                                                */
/* -------------------------------------------------------------------------- */

describe('webcam-test run()', () => {
  it('rejects an empty selection with a friendly hint', async () => {
    try {
      await tool.run({ files: [], options: {} });
      expect.unreachable('expected a ToolError');
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).message).toMatch(/Take a snapshot first/i);
    }
  });

  it('rejects more than one snapshot', async () => {
    await expect(
      tool.run({ files: [makePngFile('a.png'), makePngFile('b.png')], options: {} }),
    ).rejects.toThrow(/One snapshot at a time/i);
  });

  it('rejects an empty file', async () => {
    await expect(
      tool.run({ files: [new File([], 'empty.png', { type: 'image/png' })], options: {} }),
    ).rejects.toThrow(/is empty/i);
  });

  it('rejects a file that is not a PNG or JPEG', async () => {
    const notImage = new File(['GIF89a\x01\x00\x01\x00'], 'anim.gif', { type: 'image/gif' });
    await expect(tool.run({ files: [notImage], options: {} })).rejects.toThrow(
      /not a PNG or JPEG/i,
    );
  });

  it('rejects a malformed capture probe', async () => {
    await expect(
      tool.run({
        files: [makePngFile('cam.png', 64, 48)],
        options: { capture: JSON.stringify({ settings: { width: 'nope' } }) },
      }),
    ).rejects.toThrow(/malformed/i);
  });

  it('produces a report, a downloadable PNG and stats for a valid run', async () => {
    const file = makePngFile('cam.png', 64, 48);
    const result = await tool.run({
      files: [file],
      options: { capture: probeJson({ devices: null }) },
    });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toMatch(/\.png$/);
    expect(result.outputs[0]!.blob.type).toBe('image/png');

    const table = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual(['Item', 'Details']);
    const flat = table.rows.map((row) => row.join('|')).join('\n');
    expect(flat).toContain('Live resolution|1280 × 720');
    expect(flat).toContain('Snapshot|64 × 48 PNG');

    expect(result.stats?.resolution).toBe('64 × 48');
    expect(result.stats?.frameRate).toBe('29.9 fps');
    expect(result.stats?.cameras).toBe(0);
    const snapshotBytes = result.stats?.snapshotBytes as number;
    const outBytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    expect(snapshotBytes).toBe(outBytes.length);
  });

  it('reports a mismatch between the stream and the captured frame', async () => {
    const result = await tool.run({
      files: [makePngFile('cam.png', 1920, 1080)],
      options: { capture: probeJson() },
    });
    expect(result.warnings?.join(' ')).toMatch(/captured frame is 1920 × 1080/i);
  });

  it('keeps a JPEG snapshot as a JPEG', async () => {
    const jpeg = new File([jpegBytes(800, 600)], 'frame.jpg', { type: 'image/jpeg' });
    const result = await tool.run({ files: [jpeg], options: { capture: probeJson() } });
    expect(result.outputs[0]!.filename).toMatch(/\.jpeg$/);
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(result.stats?.resolution).toBe('800 × 600');
    expect(result.warnings?.join(' ')).toMatch(/captured frame is 800 × 600/i);
  });

  it('cancels when the signal is already aborted', async () => {
    await expect(
      tool.run({
        files: [makePngFile('cam.png', 64, 48)],
        options: {},
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow(/aborted/i);
  });
});