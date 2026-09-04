import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ndjson.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const mode = String(o.mode);

  if (mode === 'to-ndjson') {
    let value: unknown;
    try {
      value = JSON.parse(input.text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ToolError(`Input is not valid JSON: ${msg}`);
    }
    if (!Array.isArray(value)) {
      throw new ToolError(
        'Input must be a JSON array.',
        'The "JSON array → NDJSON" direction needs a top-level [ ... ] array.',
      );
    }
    const lines = value.map((item) => JSON.stringify(item ?? null));
    return {
      output: lines.join('\n'),
      render: 'code',
      language: 'json',
      stats: { elements: value.length },
    };
  }

  const rawLines = input.text.split(/\r?\n/);
  const items: unknown[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    if (line.trim() === '') continue;
    try {
      items.push(JSON.parse(line));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ToolError(`Line ${i + 1} is not valid JSON: ${msg}`);
    }
  }

  const indent = o.indent === '2' ? 2 : 0;
  return {
    output: JSON.stringify(items, null, indent),
    render: 'code',
    language: 'json',
    stats: { elements: items.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
