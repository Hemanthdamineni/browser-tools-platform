import type { ToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './speaker-test.meta';

/**
 * Speaker test is a panel-only tool — the panel handles all the audio generation
 * client-side. This module exists to satisfy the tool registry contract but is
 * never actually invoked (the panel runs entirely in the browser).
 */
async function run(): Promise<never> {
  throw new ToolError('Speaker test runs entirely in the panel UI — no server-side execution.');
}

const tool: ToolModule = { meta, run };
export default tool;