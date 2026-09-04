import { describe, it, expect } from 'vitest';
import { encodeWavPCM16, wavDataUri } from './audio';

describe('encodeWavPCM16', () => {
  it('produces the canonical 44-byte header for a 1-sample mono file', () => {
    // 1 channel, 8000 Hz, one sample of +0.5 → int16 0x4000 (16384).
    const bytes = encodeWavPCM16([Float32Array.of(0.5)], 8000);
    expect(bytes.length).toBe(46); // 44 header + 2 data
    const text = String.fromCharCode(...bytes.subarray(0, 4));
    expect(text).toBe('RIFF');
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('WAVE');
    expect(String.fromCharCode(...bytes.subarray(36, 40))).toBe('data');
    // RIFF size = 38, fmt chunk = 16 bytes, PCM = 1
    expect(bytes[4]).toBe(38);
    expect(bytes[16]).toBe(16);
    expect(bytes[20]).toBe(1);
    // mono, 8000 Hz, byte rate 16000, block align 2, 16 bits
    expect(bytes[22]).toBe(1);
    expect(bytes[24]! + (bytes[25]! << 8)).toBe(8000);
    expect(bytes[28]! + (bytes[29]! << 8)).toBe(16000);
    expect(bytes[32]! + (bytes[33]! << 8)).toBe(2);
    expect(bytes[34]! + (bytes[35]! << 8)).toBe(16);
    expect(bytes[40]! + (bytes[41]! << 8)).toBe(2); // data chunk = 2 bytes
    // sample bytes: little-endian int16
    expect(bytes[44]).toBe(0x00);
    expect(bytes[45]).toBe(0x40);
  });

  it('interleaves stereo samples L,R,L,R', () => {
    const bytes = encodeWavPCM16([Float32Array.of(0, 0.5), Float32Array.of(0.5, -1)], 44100);
    expect(bytes.length).toBe(52); // 44 + 8 data bytes (2 frames × 2 ch × 2 B)
    const dv = new DataView(bytes.buffer);
    expect(dv.getInt16(44, true)).toBe(0);
    expect(dv.getInt16(46, true)).toBe(16384); // right first frame 0.5
    expect(dv.getInt16(48, true)).toBe(16384);
    expect(dv.getInt16(50, true)).toBe(-32768); // -1 full scale negative
  });

  it('clips samples beyond ±1', () => {
    const bytes = encodeWavPCM16([Float32Array.of(2, -2)], 8000);
    const dv = new DataView(bytes.buffer);
    expect(dv.getInt16(44, true)).toBe(32767);
    expect(dv.getInt16(46, true)).toBe(-32768);
  });

  it('rejects an empty channel list', () => {
    expect(() => encodeWavPCM16([], 8000)).toThrow(/channel/i);
  });

  it('rejects a non-positive sample rate', () => {
    expect(() => encodeWavPCM16([Float32Array.of(0)], 0)).toThrow(/samplerate/i);
  });
});

describe('wavDataUri', () => {
  it('wraps bytes in a base64 audio data URI', () => {
    const bytes = encodeWavPCM16([Float32Array.of(0.5)], 8000);
    const uri = wavDataUri(bytes);
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
    const b64 = uri.slice('data:audio/wav;base64,'.length);
    // btoa/atob round-trip preserves the exact bytes
    const bin = atob(b64);
    expect(bin.length).toBe(bytes.length);
    expect(bin.charCodeAt(0)).toBe(0x52); // 'R'
    expect(bin.charCodeAt(45)).toBe(0x40);
  });
});
