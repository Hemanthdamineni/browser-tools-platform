import type { OptionValues, TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './expires-header.meta';
import { renderFamily } from './cache-headers.tool';

/**
 * Expires header builder/analyzer - forwards to cache-headers 'expires' family.
 * Preserves original option defaults and behavior via its own meta.
 */
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options) as OptionValues;
  return renderFamily('expires', input, options);
}

const tool: TextToolModule = { meta, run };
export default tool;
