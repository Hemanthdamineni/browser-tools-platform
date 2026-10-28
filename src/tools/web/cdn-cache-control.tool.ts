import type { OptionValues, TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cdn-cache-control.meta';
import { renderFamily } from './cache-headers.tool';

/**
 * CDN-Cache-Control builder/analyzer - forwards to cache-headers 'cdn-cache-control' family.
 * Preserves original option defaults and behavior via its own meta.
 */
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options) as OptionValues;
  return renderFamily('cdn-cache-control', input, options);
}

const tool: TextToolModule = { meta, run };
export default tool;
