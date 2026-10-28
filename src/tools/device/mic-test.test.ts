import { describe, it, expect, vi } from 'vitest';
import {
  pickRecordingMimeType,
  containerForMimeType,
  buildRecordingFilename,
  formatDuration,
  formatLevel,
  startRecording,
  stopRecording,
  getAudioLevel,
} from './mic-test.core';
import { ToolError } from '@/lib/types';

describe('mic-test core', () => {
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
      /mic-recording-2026-10-26-12-00-00\.webm$/,
    );
  });

  it('formatDuration formats seconds', () => {
    expect(formatDuration(1234)).toBe('1s');
    expect(formatDuration(62100)).toBe('1:02');
    expect(formatDuration(3661000)).toBe('1:01:01');
  });

  it('formatLevel returns dB', () => {
    expect(formatLevel(42.5)).toBe('42.5 dB');
  });

  it('startRecording returns chunks and duration', () => {
    const stream = {} as MediaStream;
    const factory = {
      isTypeSupported: vi.fn(),
      create: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        ondataavailable: vi.fn(),
        onerror: vi.fn(),
        state: 'inactive',
      })),
    } as any;
    const analyser = {
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      fftSize: 2048,
    } as any;
    const result = startRecording(stream, factory, analyser, { defaultDuration: 5 });
    expect(result.chunks).toEqual([]);
    expect(result.duration).toBe(5000);
  });

  it('stopRecording stops recorder and sets duration', () => {
    const session = {
      recorder: {
        state: 'recording',
        stop: vi.fn(),
      } as any,
      startTime: Date.now() - 3000,
      stopTime: undefined,
      duration: undefined,
    };
    stopRecording(session);
    expect(session.recorder.state).toBe('inactive');
    expect(session.stopTime).toBeDefined();
    expect(session.duration).toBeGreaterThanOrEqual(3000);
  });

  it('getAudioLevel calculates average', () => {
    const dataArray = new Uint8Array([128, 128, 128]);
    const analyser = { getByteFrequencyData: vi.fn((da) => da.set(dataArray)) } as any;
    expect(getAudioLevel(analyser, dataArray)).toBe(0);
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
          state: 'inactive',
          get onerror() { return errorCb; },
          set onerror(cb) { errorCb = cb; },
        };
        return recorder;
      }),
    } as any;
    const analyser = {
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      fftSize: 2048,
    } as any;
    startRecording(stream, factory, analyser);
    expect(errorCb).not.toBeNull();
    expect(() => errorCb!({ message: 'fail' })).toThrow(ToolError);
  });
});
