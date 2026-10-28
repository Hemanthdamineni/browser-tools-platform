import { describe, it, expect, vi } from 'vitest';
import {
  pickRecordingMimeType,
  containerForMimeType,
  buildRecordingFilename,
  startRecording,
} from './voice-recorder.core';
import { ToolError } from '@/lib/types';

describe('voice-recorder core', () => {
  it('picks mime type preferring opus', () => {
    const support = vi.fn((t: string) => t === 'audio/webm;codecs=opus');
    expect(pickRecordingMimeType(support)).toBe('audio/webm;codecs=opus');
  });

  it('falls back to webm if opus not supported', () => {
    const support = vi.fn((t: string) => t === 'audio/webm');
    expect(pickRecordingMimeType(support)).toBe('audio/webm');
  });

  it('returns wav if only wav supported', () => {
    const support = vi.fn((t: string) => t === 'audio/wav');
    expect(pickRecordingMimeType(support)).toBe('audio/wav');
  });

  it('containerForMimeType returns webm for webm mime', () => {
    expect(containerForMimeType('audio/webm')).toBe('webm');
    expect(containerForMimeType('audio/webm;codecs=opus')).toBe('webm');
  });

  it('buildRecordingFilename uses timestamp', () => {
    const date = new Date('2026-10-26T12:00:00Z');
    expect(buildRecordingFilename('webm', date)).toMatch(
      /voice-recording-2026-10-26-12-00-00\.webm$/,
    );
  });

  it('startRecording returns chunks', () => {
    const stream = {} as MediaStream;
    const analyser = {
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      fftSize: 2048,
    };
    const factory = {
      isTypeSupported: vi.fn(),
      create: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        ondataavailable: vi.fn(),
        onerror: vi.fn(),
        state: 'recording',
        mimeType: 'audio/webm',
      })),
    } as any;
    const result = startRecording(stream, factory, analyser);
    expect(result.chunks).toEqual([]);
    expect(result.duration).toBeUndefined();
  });

  it('throws on recording error', () => {
    const stream = {} as MediaStream;
    let errorCb: ((e: any) => void) | null = null;
    const factory = {
      isTypeSupported: vi.fn(),
      create: vi.fn(() => {
        const recorder: any = {
          start: vi.fn(),
          stop: vi.fn(),
          ondataavailable: vi.fn(),
          get onerror() { return errorCb; },
          set onerror(cb) { errorCb = cb; },
        };
        return recorder;
      }),
    } as any;
    startRecording(stream, factory);
    expect(errorCb).not.toBeNull();
    expect(() => errorCb!({ message: 'fail' })).toThrow(ToolError);
  });
});
