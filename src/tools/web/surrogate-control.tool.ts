import type { OptionValues, TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './surrogate-control.meta';
import { renderFamily } from './cache-headers.tool';

/**
 * Surrogate-Control builder/analyzer - forwards to cache-headers 'surrogate-control' family.
 * Preserves original option defaults and behavior via its own meta.
 */
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options) as OptionValues;
  return renderFamily('surrogate-control', input, options);
}

const tool: TextToolModule = { meta, run };
export default tool;
