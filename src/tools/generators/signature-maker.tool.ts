/**
 * The signature maker.
 *
 * The interactive drawing and typing live in the panel
 * (`src/components/panels/signature-maker.astro`); this module is the pure,
 * headless entry point. It takes a payload — a typed name or a JSON list of
 * drawn strokes — and serialises it into a transparent SVG that the workbench
 * can preview and download pressing the same logic the panel uses.
 *
 * Reuses the shared signature module (`@/lib/signature`): the typed font
 * stacks and the data-URL encoder come from there, so the maker and `pdf-sign`
 * agree on the signature styles.
 */
import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { renderSignature } from '@/components/panels/signature-maker-panel';
import { meta } from './signature-maker.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  return renderSignature(input.text ?? '', o);
}

const tool: TextToolModule = { meta, run };
export default tool;