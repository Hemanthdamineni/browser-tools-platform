import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { meta } from './unicode-escape.meta';
import stringEscapeTool from '@/tools/developer/string-escape.tool';

async function run(input: TextRunInput): Promise<TextRunResult> {
  return stringEscapeTool.run({
    ...input,
    options: { ...input.options, target: 'unicode' },
  });
}

const tool: TextToolModule = { meta, run };
export default tool;