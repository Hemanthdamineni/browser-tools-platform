import type { ToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './tuner.meta';

/**
 * Tuner is a panel-only tool — the panel handles all the microphone access
 * and pitch detection client-side. This module exists to satisfy the
 * tool registry contract but is never actually invoked (the panel runs
 * entirely in the browser).
 */
async function run(): Promise<never> {
  throw new ToolError('Tuner runs entirely in the panel UI — no server-side execution.');
}

const tool: ToolModule = { meta, run };
export default tool;