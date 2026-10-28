import type { ToolModule } from '@/lib/types';
import { meta } from './image-to-datauri.meta';
import { run } from '@/tools/web/data-uri.tool';

const tool: ToolModule = { meta, run };
export default tool;