/**
 * Real-engine integration: these tests exercise the actual Mediabunny import
 * (no fakes) against small synthetic files. They prove that lazy loading and
 * the `ToolError` translation work together; the heavy branch coverage lives in
 * `index.test.ts` with an injected engine.
 */
import { describe, it, expect } from 'vitest';
import { encodeWavPCM16 } from '@/lib/audio';
import { isVideoEngineLoaded, probeVideoFile } from './index';

function wavFile(name = 'tone.wav'): File {
  const channel = new Float32Array(800);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.sin((i / 800) * Math.PI * 2 * 5) * 0.5;
  const bytes = encodeWavPCM16([channel], 8000);
  const part = bytes.slice().buffer as ArrayBuffer;
  return new File([part], name, { type: 'audio/wav' });
}

describe('video engine (real Mediabunny)', () => {
  it('lazily loads the engine and rejects a non-media file', async () => {
    expect(isVideoEngineLoaded()).toBe(false);
    const text = new File([new TextEncoder().encode('definitely not a video')], 'notes.txt', {
      type: 'text/plain',
    });
    await expect(probeVideoFile(text)).rejects.toThrow(/not a video container/i);
    expect(isVideoEngineLoaded()).toBe(true);
  });

  it('parses a real audio-only container and reports the missing video track', async () => {
    await expect(probeVideoFile(wavFile('tone 🔊.wav'))).rejects.toThrow(/no video track/i);
  });
});
