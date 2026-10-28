import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { meta } from './access-control-max-age.meta';
import corsHeadersTool from './cors-headers.tool';

const tool: TextToolModule = {
  meta,
  async run(input: TextRunInput): Promise<TextRunResult> {
    return corsHeadersTool.run(input);
  },
};
export default tool;