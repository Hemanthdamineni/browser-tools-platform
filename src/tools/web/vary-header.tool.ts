import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './vary-header.meta';
import { renderFamily } from './cache-headers.tool';

/**
 * Legacy route kept for URL stability. This tool is now a thin delegate to the
 * unified `cache-headers` tool with the "vary" family preselected; the
 * original option keys and behaviour are unchanged.
 */
function run(input: TextRunInput): TextRunResult {
  return renderFamily('vary', input, resolveOptions(meta, input.options));
}

const tool: TextToolModule = { meta, run };
export default tool;
