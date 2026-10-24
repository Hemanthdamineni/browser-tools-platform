import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { meta } from './base64-file.meta';
import base64Tool from '../encoding/base64.tool';

/**
 * Legacy route kept for URL stability. This tool is now a thin delegate to the
 * unified `base64` tool, which handles both text and file input; the original
 * file-only behaviour is unchanged.
 */
function run(input: FileRunInput): Promise<FileRunResult> {
  return base64Tool.run(input);
}

const tool: FileToolModule = { meta, run };
export default tool;