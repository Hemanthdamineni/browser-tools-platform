import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './bpm-detector.meta';
import { detectBpm, BpmDetectorOptions } from './bpm-detector.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose an audio file.');

  const file = files[0]!;
  onProgress?.(0.1, 'Decoding audio');

  const options: BpmDetectorOptions = {
    minBpm: Number(o.minBpm ?? 60),
    maxBpm: Number(o.maxBpm ?? 180),
    onsetThreshold: Number(o.onsetThreshold ?? 0.3),
  };

  const result = await detectBpm(file, options);
  signal?.throwIfAborted?.();

  onProgress?.(1, 'Done');

  const candidateRows = result.candidates.map(c => [
    `${c.bpm.toFixed(1)} BPM`,
    `${(c.confidence * 100).toFixed(1)}%`,
  ]);

  return {
    outputs: [],
    report: {
      output: JSON.stringify({
        headers: ['Tempo Candidate', 'Confidence'],
        rows: candidateRows,
      }),
      render: 'table',
    },
    notes: [
      `Detected ${result.onsetCount} onsets over ${result.durationSec.toFixed(1)}s`,
      `Primary tempo: ${result.bpm} BPM (${(result.confidence * 100).toFixed(1)}% confidence)`,
    ],
    stats: {
      bpm: result.bpm,
      confidence: result.confidence,
      onsetCount: result.onsetCount,
      durationSec: result.durationSec,
      candidates: result.candidates.length,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;