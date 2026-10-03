import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './audio-info.meta';
import { decodeFile, formatDuration, amplitudeToDb } from './lib';

function peakOf(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]!);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

function rmsOf(channels: Float32Array[]): number {
  let sum = 0;
  let count = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i]!;
      sum += s * s;
      count++;
    }
  }
  if (count === 0) return 0;
  return Math.sqrt(sum / count);
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose an audio file.');

  onProgress?.(0.1, 'Decoding');
  const a = await decodeFile(files[0]!);
  signal?.throwIfAborted?.();
  onProgress?.(0.9, 'Analysing');

  const frames = a.channels[0]?.length ?? 0;
  const durationSec = frames / a.sampleRate;
  const peaks = a.channels.map((channel) => peakOf([channel]));
  const peakDb = amplitudeToDb(Math.max(...peaks));
  const rmsDb = amplitudeToDb(rmsOf(a.channels));
  const hasClipping = peaks.some((p) => p >= 1.0);
  const bitrate = durationSec > 0 ? (a.byteSize * 8) / durationSec : 0;

  const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : '—');
  const fmtDb = (db: number) => (Number.isFinite(db) ? `${db.toFixed(1)} dB` : '−∞ dB');

  const rows: string[][] = [
    ['File name', files[0]!.name],
    ['MIME type', a.mimeType || 'unknown'],
    ['File size', `${a.byteSize.toLocaleString()} bytes`],
    ['Duration', `${durationSec.toFixed(3)} s (${formatDuration(durationSec)})`],
    ['Sample rate', `${a.sampleRate.toLocaleString()} Hz`],
    ['Channels', String(a.channels.length)],
  ];
  a.channels.forEach((_, i) =>
    rows.push([`Channel ${i + 1} peak`, fmtDb(peakOf([a.channels[i]!]))]),
  );
  rows.push(
    ['Total samples', fmt(frames)],
    ['Estimated bitrate', durationSec > 0 ? `${Math.round(bitrate).toLocaleString()} bps` : '—'],
    ['Peak level', fmtDb(peakDb)],
    ['RMS level', fmtDb(rmsDb)],
    ['Contains clipping', hasClipping ? 'Yes' : 'No'],
  );

  const warnings: string[] = [];
  if (hasClipping) warnings.push('The audio contains samples at full scale — it is clipping.');

  onProgress?.(1, 'Done');
  return {
    outputs: [],
    report: {
      output: JSON.stringify({
        headers: ['Property', 'Value'],
        rows,
      }),
      render: 'table',
    },
    warnings: warnings.length ? warnings : undefined,
    stats: {
      channels: a.channels.length,
      sampleRate: a.sampleRate,
      durationMs: Math.round(durationSec * 1000),
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
