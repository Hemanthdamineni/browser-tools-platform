import type { OptionValues, TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cache-status.meta';
import { renderFamily } from './cache-headers.tool';

/**
 * Cache-Status header analyzer - forwards to cache-headers 'cache-status' family.
 * Preserves original option defaults and behavior via its own meta.
 */
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options) as OptionValues;
  return renderFamily('cache-status', input, options);
}

const tool: TextToolModule = { meta, run };
export default tool;
