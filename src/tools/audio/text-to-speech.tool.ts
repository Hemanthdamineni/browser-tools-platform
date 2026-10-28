import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-to-speech.meta';
import { speak, getAvailableVoices, TextToSpeechOptions } from './text-to-speech.core';

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();

  if (!text) {
    throw new ToolError('Please enter some text to speak.');
  }

  const options: TextToSpeechOptions = {
    voice: o.voice || undefined,
    rate: Number(o.rate) || 1,
    pitch: Number(o.pitch) || 1,
  };

  try {
    await speak(text, options);
    return {
      output: `Speaking: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
      stats: {
        characters: text.length,
        rate: options.rate,
        pitch: options.pitch,
      },
    };
  } catch (err) {
    throw new ToolError(`Failed to speak text: ${(err as Error).message}`);
  }
}

const tool: TextToolModule = { meta, run };
export default tool;
