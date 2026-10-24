import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './image-to-datauri.meta';
import { run as runDataUri } from '../web/data-uri.tool';

export { wrapDataUri } from '../web/data-uri.core';

/**
 * Legacy route kept for URL stability. This tool is now a thin delegate to the
 * unified `data-uri` tool with the "image → data: URI" mode preselected; the
 * original option keys and behaviour are unchanged.
 */
function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  return runDataUri({
    ...input,
    options: {
      mode: 'image-encode',
      wrap: String(o.wrap),
      mediaQueryComment: Boolean(o.mediaQueryComment),
    },
  });
}

const tool: FileToolModule = { meta, run };
export default tool;
