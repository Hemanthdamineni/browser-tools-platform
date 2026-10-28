/**
 * Speech-to-Text core — lightweight Whisper (tiny/base) via transformers.js.
 *
 * Runs entirely in the browser. Supports file upload and microphone input
 * (the panel records the mic stream and passes the Blob to this module).
 * Returns word-level timestamps when requested. Exports plain TXT, SRT and VTT.
 */
import { ToolError } from '@/lib/types';
import { loadModel } from '@/lib/ml';

export interface WhisperResult {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

export interface SpeechToTextOptions {
  model: 'tiny' | 'base';
  timestamps: boolean;
  language: string;
}

export async function loadWhisperPipeline(options: SpeechToTextOptions) {
  const model = options.model === 'base' ? 'Xenova/whisper-base' : 'Xenova/whisper-tiny';
  const { pipeline, dispose } = await loadModel({
    task: 'automatic-speech-recognition',
    model,
    pipelineOptions: {
      return_timestamps: options.timestamps ? 'word' : false,
      language: options.language || undefined,
      task: 'transcribe',
    },
  });
  return { pipeline, dispose };
}

export async function transcribeAudio(
  audio: Blob,
  options: SpeechToTextOptions,
): Promise<WhisperResult> {
  const { pipeline, dispose } = await loadWhisperPipeline(options);
  try {
    const result = await pipeline(audio);
    return result;
  } finally {
    await dispose();
  }
}

export function generateTXT(result: WhisperResult): string {
  let out = result.text;
  if (result.chunks && result.chunks.length) {
    out = result.chunks.map((c) => c.text).join(' ');
  }
  return out;
}

export function generateSRT(result: WhisperResult): string {
  if (!result.chunks) return '';
  return result.chunks
    .map((chunk, idx) => {
      const [start, end] = chunk.timestamp;
      const startStr = formatTimecode(start);
      const endStr = formatTimecode(end);
      return `${idx + 1}\n${startStr} --> ${endStr}\n${chunk.text}\n\n`;
    })
    .join('');
}

export function generateVTT(result: WhisperResult): string {
  if (!result.chunks) return '';
  return `WEBVTT\n\n${result.chunks
    .map((chunk, idx) => {
      const [start, end] = chunk.timestamp;
      const startStr = formatTimecode(start);
      const endStr = formatTimecode(end);
      return `${startStr} --> ${endStr}\n${chunk.text}\n`;
    })
    .join('\n\n')}\n`;
}

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

export function formatTimestamp(seconds: number): string {
  return formatTimecode(seconds);
}
