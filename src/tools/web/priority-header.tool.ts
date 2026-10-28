import type { ToolModule } from '@/lib/types';
import { meta } from './priority-header.meta';
import { run } from '@/tools/web/http-header-analyzer.tool';

const tool: ToolModule = { meta, run };
export default tool;
