import type { ToolModule } from '@/lib/types';
import { meta } from './link-header.meta';
import { run } from '@/tools/web/http-header-analyzer.tool';

const tool: ToolModule = { meta, run };
export default tool;
