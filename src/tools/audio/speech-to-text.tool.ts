import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './speech-to-text.meta';
import {
  transcribeAudio,
  generateTXT,
  generateSRT,
  generateVTT,
  formatTimestamp,
} from './speech-to-text.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) {
    throw new ToolError('No audio file provided.');
  }
  const file = input.files[0]!;
  if (!file.size) {
    throw new ToolError('The audio file is empty.');
  }
  const options = {
    model: String(o.model ?? 'tiny'),
    timestamps: o.timestamps ?? true,
    language: String(o.language ?? ''),
  };
  const result = await transcribeAudio(file, options);
  const stemName = file.name.replace(/\.[^/.]+$/, '');
  const outputs = [
    {
      filename: `${stemName}-transcript.txt`,
      blob: new Blob([generateTXT(result)], { type: 'text/plain' }),
    },
    {
      filename: `${stemName}-transcript.srt`,
      blob: new Blob([generateSRT(result)], { type: 'text/vtt' }),
    },
    {
      filename: `${stemName}-transcript.vtt`,
      blob: new Blob([generateVTT(result)], { type: 'text/vtt' }),
    },
  ];
  const notes = [`Transcribed with Whisper ${options.model} model.`];
  if (options.timestamps) notes.push('Word-level timestamps included.');
  return {
    outputs,
    notes,
    stats: {
      model: options.model,
      language: options.language || 'auto',
      textLength: result.text.length,
      chunks: result.chunks ? result.chunks.length : 0,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
