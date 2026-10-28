import type { ToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './dead-pixel-test.meta';

/**
 * Dead pixel test is a panel-only tool — the panel handles the fullscreen
 * color cycling client-side. This module exists to satisfy the tool registry
 * contract but is never actually invoked.
 */
async function run(): Promise<never> {
  throw new ToolError('Dead pixel test runs entirely in the panel UI — no server-side execution.');
}

const tool: ToolModule = { meta, run };
export default tool;