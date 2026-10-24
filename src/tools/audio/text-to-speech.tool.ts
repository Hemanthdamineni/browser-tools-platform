/**
 * Text-to-speech tool.
 *
 * The panel owns the browser APIs — `speechSynthesis` plays through the
 * speaker and cannot run inside the pure `run()` function. So this module
 * validates the text and settings and returns the exact speech plan the panel
 * (or any caller) will speak: the trimmed text, the requested voice and the
 * clamped rate / pitch / volume. The pure helpers live in the panel module
 * and are shared, so the panel and `run()` build identical plans.
 */
import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { buildUtteranceConfig, normalizeSettings, planToResult } from '@/components/panels/text-to-speech-panel';
import { meta } from './text-to-speech.meta';

/** The tool's input. `options` may be omitted — the declared defaults apply. */
export type TextToSpeechInput = Omit<TextRunInput, 'options'> & {
  options?: OptionValues;
};

function run(input: TextToSpeechInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text;
  if (!text || !text.trim()) {
    throw new ToolError('Enter some text to speak.', 'It cannot be blank.');
  }

  const settings = normalizeSettings({
    voiceId: String(o.voice ?? ''),
    rate: Number(o.rate),
    pitch: Number(o.pitch),
    volume: Number(o.volume),
  });
  const config = buildUtteranceConfig(text, settings);
  return planToResult(config);
}

/** Run the text-to-speech planner. Pure — it never touches `speechSynthesis`. */
export const runTextToSpeech: typeof run = run;

const tool: TextToolModule = { meta, run };
export default tool;