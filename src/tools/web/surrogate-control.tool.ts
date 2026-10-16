import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './surrogate-control.meta';
import { renderFamily } from './cache-headers.tool';

/**
 * Legacy route kept for URL stability. This tool is now a thin delegate to the
 * unified `cache-headers` tool with the "surrogate-control" family preselected; the
 * original option keys and behaviour are unchanged.
 */
function run(input: TextRunInput): TextRunResult {
  return renderFamily('surrogate-control', input, resolveOptions(meta, input.options));
}

const tool: TextToolModule = { meta, run };
export default tool;
