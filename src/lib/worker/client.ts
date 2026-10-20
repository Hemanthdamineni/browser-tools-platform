import type { RegisteredTool } from '../types';
import { capabilities } from '../capabilities';
import { getTool } from '../registry';

export interface RunOptions {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./tool.worker.ts', import.meta.url), {
      type: 'module',
      name: 'toolbench-tool',
    });
  }
  return worker;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `t-${Math.random().toString(36).slice(2)}-${performance.now()}`;
}

function runInWorker<T>(
  toolId: string,
  payload: Record<string, unknown>,
  opts: RunOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const w = getWorker();
    const id = uid();

    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      opts.signal?.removeEventListener('abort', onAbort);
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.id !== id) return;
      if (data.type === 'progress') {
        opts.onProgress?.(data.fraction, data.message);
      } else if (data.type === 'result') {
        cleanup();
        resolve(data.result as T);
      } else if (data.type === 'error') {
        cleanup();
        const err = new Error(data.message);
        err.name = data.name || 'Error';
        (err as Error & { hint?: string }).hint = data.hint;
        reject(err);
      }
    };
    const onAbort = () => {
      cleanup();
      // Terminate so an in-flight heavy job actually stops; next run respawns.
      w.terminate();
      worker = null;
      reject(new DOMException('The operation was cancelled.', 'AbortError'));
    };

    w.addEventListener('message', onMessage);
    opts.signal?.addEventListener('abort', onAbort);
    w.postMessage({ id, toolId, payload });
  });
}

/**
 * Execute a tool. File tools (and any tool with `meta.worker === true`) run in a
 * Web Worker so the UI never freezes; everything else runs inline.
 */
export async function runTool<T>(
  tool: RegisteredTool,
  payload: Record<string, unknown>,
  opts: RunOptions = {},
): Promise<T> {
  const useWorker = tool.meta.worker ?? tool.meta.input !== 'text';

  if (useWorker && capabilities.workers) {
    return runInWorker<T>(tool.meta.id, payload, opts);
  }

  const mod = await tool.load();
  return (await mod.default.run({
    ...payload,
    signal: opts.signal,
    onProgress: opts.onProgress,
  } as never)) as T;
}

export async function runToolById<T>(
  id: string,
  payload: Record<string, unknown>,
  opts: RunOptions = {},
): Promise<T> {
  const tool = getTool(id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return runTool<T>(tool, payload, opts);
}

export function disposeWorker(): void {
  worker?.terminate();
  worker = null;
}
