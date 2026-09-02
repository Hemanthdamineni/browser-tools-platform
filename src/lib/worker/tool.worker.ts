/// <reference lib="webworker" />
/**
 * Generic tool worker. Receives `{ id, toolId, payload }`, lazily imports the
 * matching `<toolId>.tool.ts`, runs it, streams progress back, posts the result.
 * Heavy dependencies (pdf-lib, fflate, …) only load inside the worker that needs them.
 */
import type { ToolModule } from '../types';

const loaders = import.meta.glob('../../tools/**/*.tool.ts');

type IncomingMessage = {
  id: string;
  toolId: string;
  payload: Record<string, unknown>;
};

function findLoader(toolId: string): (() => Promise<unknown>) | undefined {
  const suffix = `/${toolId}.tool.ts`;
  const key = Object.keys(loaders).find((k) => k.endsWith(suffix));
  return key ? loaders[key] : undefined;
}

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const { id, toolId, payload } = event.data;
  try {
    const loader = findLoader(toolId);
    if (!loader) throw new Error(`Unknown tool: ${toolId}`);
    const mod = (await loader()) as { default: ToolModule };
    const run = mod.default?.run;
    if (typeof run !== 'function') throw new Error(`Tool "${toolId}" has no run()`);

    const result = await run({
      ...payload,
      onProgress: (fraction: number, message?: string) =>
        self.postMessage({ id, type: 'progress', fraction, message }),
    } as never);

    self.postMessage({ id, type: 'result', result });
  } catch (err) {
    const e = err as { message?: string; name?: string; hint?: string };
    self.postMessage({
      id,
      type: 'error',
      message: e?.message ?? String(err),
      name: e?.name ?? 'Error',
      hint: e?.hint,
    });
  }
});
