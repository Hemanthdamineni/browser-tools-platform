import type { ToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { meta } from './base64-file.meta';
import base64Tool from '@/tools/encoding/base64.tool';

const tool: ToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    return base64Tool.run(input);
  },
};
export default tool;
