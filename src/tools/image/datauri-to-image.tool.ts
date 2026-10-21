import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { meta } from './datauri-to-image.meta';
import { run as runDataUri } from '../web/data-uri.tool';

export { parseImageDataUri as parseDataUri } from '../web/data-uri.core';

/**
 * Legacy route kept for URL stability. This tool is now a thin delegate to the
 * unified `data-uri` tool with the "data: URI → image" mode preselected; the
 * original behaviour is unchanged.
 */
function run(input: FileRunInput): Promise<FileRunResult> {
  return runDataUri({ ...input, options: { mode: 'image-decode' } });
}

const tool: FileToolModule = { meta, run };
export default tool;
