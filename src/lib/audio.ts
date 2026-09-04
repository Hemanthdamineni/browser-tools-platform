/**
 * Minimal, dependency-free RIFF/WAVE encoder (PCM 16-bit, little-endian).
 * Worker-safe and SSR-safe: no DOM, no Node APIs — `btoa` only, which is in the
 * allowed-globals list for `run()`.
 *
 * Used by the E4 audio tools and the `tone-generator` text tool.
 */

/** Convert float samples (-1..1) to interleaved 16-bit PCM bytes. */
function interleave16(channels: Float32Array[], frames: number): Uint8Array {
  const numChannels = channels.length;
  const out = new Uint8Array(frames * numChannels * 2);
  const view = new DataView(out.buffer);
  let off = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = channels[c]?.[i] ?? 0;
      const clamped = s < -1 ? -1 : s > 1 ? 1 : s;
      // Asymmetric scaling keeps 0 dBFS at ±full scale (−32768 … +32767).
      const v = Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      view.setInt16(off, v, true);
      off += 2;
    }
  }
  return out;
}

/**
 * Encode float32 channels as a 16-bit PCM RIFF/WAVE file.
 * Channels are interleaved; every channel must be the same length (shorter
 * channels are treated as zero-padded).
 */
export function encodeWavPCM16(channels: Float32Array[], sampleRate: number): Uint8Array {
  if (channels.length === 0) {
    throw new Error('encodeWavPCM16: at least one channel is required');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('encodeWavPCM16: sampleRate must be a positive finite number');
  }
  let frames = 0;
  for (const ch of channels) frames = Math.max(frames, ch.length);

  const numChannels = channels.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const fileBytes = 44 + dataBytes; // 44-byte canonical header

  const out = new Uint8Array(fileBytes);
  const view = new DataView(out.buffer);
  let o = 0;
  const ascii = (s: string) => {
    for (let i = 0; i < s.length; i++) out[o++] = s.charCodeAt(i);
  };
  const u32 = (v: number) => {
    view.setUint32(o, v, true);
    o += 4;
  };
  const u16 = (v: number) => {
    view.setUint16(o, v, true);
    o += 2;
  };

  ascii('RIFF');
  u32(fileBytes - 8);
  ascii('WAVE');
  ascii('fmt ');
  u32(16); // PCM fmt chunk size
  u16(1); // format: PCM
  u16(numChannels);
  u32(sampleRate);
  u32(sampleRate * blockAlign); // byte rate
  u16(blockAlign);
  u16(16); // bits per sample
  ascii('data');
  u32(dataBytes);

  out.set(interleave16(channels, frames), o);
  return out;
}

/** Wrap WAV bytes in a `data:` URI so a text tool can return them directly. */
export function wavDataUri(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}
