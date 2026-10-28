import type { OptionValues, TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './age-header.meta';
import { renderFamily } from './cache-headers.tool';

/**
 * Age header analyzer - forwards to cache-headers 'age' family.
 * Preserves original option defaults and behavior via its own meta.
 */
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options) as OptionValues;
  return renderFamily('age', input, options);
}

const tool: TextToolModule = { meta, run };
export default tool;
