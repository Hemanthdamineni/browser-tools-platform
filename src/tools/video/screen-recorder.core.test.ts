import { describe, it, expect } from 'vitest';
import {
  MAX_RECORDING_BYTES,
  MP4_MIME_CANDIDATES,
  WEBM_MIME_CANDIDATES,
  describeCaptureError,
  extensionForFormat,
  formatDuration,
  formatElapsed,
  formatForMimeType,
  formatFromFileName,
  labelForFormat,
  normalizeBitrate,
  normalizeDuration,
  outputFileName,
  pickMimeType,
  recordingFileName,
  supportsMp4,
  supportsWebm,
} from './screen-recorder.core';

/** A `supported()` probe that only knows about the given types. */
function only(...types: string[]): (type: string) => boolean {
  const set = new Set(types);
  return (type) => set.has(type);
}

describe('pickMimeType', () => {
  it('prefers WebM when the browser supports it', () => {
    expect(pickMimeType(only('video/webm;codecs=vp9,opus'))).toBe('video/webm;codecs=vp9,opus');
  });

  it('falls back through the WebM candidates in order', () => {
    expect(pickMimeType(only('video/webm;codecs=vp8,opus', 'video/webm'))).toBe(
      'video/webm;codecs=vp8,opus',
    );
    expect(pickMimeType(only('video/webm'))).toBe('video/webm');
  });

  it('prefers MP4 when MP4 is asked for', () => {
    expect(pickMimeType(only('video/mp4;codecs=avc1', 'video/webm'), 'mp4')).toBe(
      'video/mp4;codecs=avc1',
    );
  });

  it('falls back to the other container when the preferred one is missing', () => {
    // Safari records MP4 but not WebM.
    expect(pickMimeType(only('video/mp4'), 'webm')).toBe('video/mp4');
    // A browser without WebM can still record MP4.
    expect(pickMimeType(only('video/mp4'), 'webm')).toBe('video/mp4');
    // A browser without MP4 records WebM instead.
    expect(pickMimeType(only('video/webm'), 'mp4')).toBe('video/webm');
  });

  it('never returns MP4 when the browser does not support it', () => {
    const mime = pickMimeType(only('video/webm'), 'mp4');
    expect(mime?.startsWith('video/mp4')).toBe(false);
  });

  it('returns null when nothing is supported', () => {
    expect(pickMimeType(() => false)).toBeNull();
  });

  it('survives a probe that throws', () => {
    const throwing = (type: string): boolean => {
      if (type === 'video/webm;codecs=vp9,opus') throw new Error('boom');
      return type === 'video/webm';
    };
    expect(pickMimeType(throwing)).toBe('video/webm');
  });

  it('knows which containers the browser can record', () => {
    expect(supportsWebm(only('video/webm'))).toBe(true);
    expect(supportsWebm(only('video/mp4'))).toBe(false);
    expect(supportsMp4(only('video/mp4;codecs=avc1'))).toBe(true);
    expect(supportsMp4(only('video/webm'))).toBe(false);
    expect(supportsMp4(() => false)).toBe(false);
  });

  it('lists the MP4 codec variant it probes for', () => {
    expect(MP4_MIME_CANDIDATES).toContain('video/mp4');
    expect(MP4_MIME_CANDIDATES.some((m) => m.includes('avc1'))).toBe(true);
    expect(WEBM_MIME_CANDIDATES.every((m) => m.startsWith('video/webm'))).toBe(true);
  });
});

describe('container detection', () => {
  it('reads the container from a MIME type', () => {
    expect(formatForMimeType('video/webm;codecs=vp9,opus')).toBe('webm');
    expect(formatForMimeType('video/mp4')).toBe('mp4');
    expect(formatForMimeType('VIDEO/MP4')).toBe('mp4');
    expect(formatForMimeType('audio/webm')).toBeNull();
    expect(formatForMimeType('')).toBeNull();
  });

  it('reads the container from a file name', () => {
    expect(formatFromFileName('clip.webm')).toBe('webm');
    expect(formatFromFileName('clip.MP4')).toBe('mp4');
    expect(formatFromFileName('clip.mov')).toBe('mp4');
    expect(formatFromFileName('clip.bin')).toBeNull();
  });

  it('names the extension and the label of a container', () => {
    expect(extensionForFormat('webm')).toBe('webm');
    expect(extensionForFormat('mp4')).toBe('mp4');
    expect(labelForFormat('webm')).toBe('WebM');
    expect(labelForFormat('mp4')).toBe('MP4 (H.264)');
  });
});

describe('outputFileName', () => {
  it('keeps the base name and uses the recorded extension', () => {
    expect(outputFileName('screen-recording-2026-10-21-16-04-07.webm', 'webm')).toBe(
      'screen-recording-2026-10-21-16-04-07.webm',
    );
    expect(outputFileName('clip.mp4', 'webm')).toBe('clip.webm');
    expect(outputFileName('clip', 'mp4')).toBe('clip.mp4');
  });

  it('falls back to a sensible name', () => {
    expect(outputFileName('', 'mp4')).toBe('screen-recording.mp4');
    expect(outputFileName('.webm', 'webm')).toBe('screen-recording.webm');
  });

  it('keeps Unicode names intact and removes path separators', () => {
    expect(outputFileName('презентация 日本語 🎥.webm', 'webm')).toBe('презентация 日本語 🎥.webm');
    expect(outputFileName('a/b\\c.webm', 'mp4')).toBe('a-b-c.mp4');
  });
});

describe('recordingFileName', () => {
  it('stamps the local date and time into the name', () => {
    const when = new Date(2026, 9, 21, 16, 4, 7);
    expect(recordingFileName(when, 'webm')).toBe('screen-recording-20261021-160407.webm');
    expect(recordingFileName(when, 'mp4')).toBe('screen-recording-20261021-160407.mp4');
  });

  it('survives an invalid date', () => {
    expect(recordingFileName(new Date('nope'), 'webm')).toMatch(
      /^screen-recording-\d{8}-\d{6}\.webm$/,
    );
  });
});

describe('formatElapsed', () => {
  it('formats minutes and seconds', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(999)).toBe('0:00');
    expect(formatElapsed(7_000)).toBe('0:07');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(599_000)).toBe('9:59');
  });

  it('adds hours from an hour on', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });

  it('never shows NaN', () => {
    expect(formatElapsed(Number.NaN)).toBe('0:00');
    expect(formatElapsed(-5)).toBe('0:00');
    expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('formatDuration', () => {
  it('reports an unknown length honestly', () => {
    expect(formatDuration(null)).toBe('Unknown');
    expect(formatDuration(undefined)).toBe('Unknown');
    expect(formatDuration(0)).toBe('Unknown');
    expect(formatDuration(-3)).toBe('Unknown');
    expect(formatDuration(Number.NaN)).toBe('Unknown');
  });

  it('formats short, medium and long recordings', () => {
    expect(formatDuration(12.34)).toBe('12.3 s');
    expect(formatDuration(65)).toBe('1 m 05 s');
    expect(formatDuration(3723)).toBe('1 h 02 m 03 s');
  });
});

describe('normalizeDuration / normalizeBitrate', () => {
  it('reads a duration in seconds', () => {
    expect(normalizeDuration(12.5)).toBe(12.5);
    expect(normalizeDuration('12.5')).toBe(12.5);
  });

  it('rejects a missing or broken duration', () => {
    expect(normalizeDuration(0)).toBeNull();
    expect(normalizeDuration(-1)).toBeNull();
    expect(normalizeDuration('abc')).toBeNull();
    expect(normalizeDuration(undefined)).toBeNull();
    expect(normalizeDuration(Number.NaN)).toBeNull();
  });

  it('reads a bitrate', () => {
    expect(normalizeBitrate('5000000')).toBe(5_000_000);
    expect(normalizeBitrate(2_500_000)).toBe(2_500_000);
    expect(normalizeBitrate(0)).toBeNull();
    expect(normalizeBitrate('nope')).toBeNull();
  });
});

describe('describeCaptureError', () => {
  it('explains a denied screen prompt', () => {
    const info = describeCaptureError(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    expect(info.message).toMatch(/denied/i);
    expect(info.hint).toMatch(/share screen/i);
  });

  it('explains a denied microphone prompt', () => {
    const info = describeCaptureError(
      Object.assign(new Error('x'), { name: 'NotAllowedError' }),
      'microphone',
    );
    expect(info.message).toMatch(/microphone/i);
    expect(info.hint).toMatch(/without it/i);
  });

  it('explains a browser without the API', () => {
    const info = describeCaptureError(Object.assign(new Error('x'), { name: 'TypeError' }));
    expect(info.message).toMatch(/cannot share a screen/i);
    expect(info.hint).toMatch(/https/i);
  });

  it('explains a closed picker and a busy screen', () => {
    expect(describeCaptureError({ name: 'AbortError' }).message).toMatch(/picker was closed/i);
    expect(describeCaptureError({ name: 'NotReadableError' }).message).toMatch(
      /could not be captured/i,
    );
    expect(describeCaptureError({ name: 'NotFoundError' }).message).toMatch(/no screen or window/i);
  });

  it('falls back to the original message', () => {
    expect(describeCaptureError(new Error('something odd')).message).toBe('something odd');
    expect(describeCaptureError(undefined).message).toMatch(/could not be shared/i);
  });
});

describe('limits', () => {
  it('caps a recording at 1 GB', () => {
    expect(MAX_RECORDING_BYTES).toBe(1024 * 1024 * 1024);
  });
});
