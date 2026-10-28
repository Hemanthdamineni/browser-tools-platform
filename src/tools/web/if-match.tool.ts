import type { TextToolModule } from '@/lib/types';
import { meta } from './if-match.meta';
import canonicalTool from './conditional-request-headers.tool';

const tool: TextToolModule = { meta, run: canonicalTool.run };
export default tool;