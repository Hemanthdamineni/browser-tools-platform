import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-zod.meta';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function zodType(value: Json, ind: number): string {
  const pad = '  '.repeat(ind);
  if (value === null) return 'z.any()';
  if (typeof value === 'string') return 'z.string()';
  if (typeof value === 'boolean') return 'z.boolean()';
  if (typeof value === 'number') return 'z.number()';
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== null);
    if (first === undefined) return 'z.array(z.any())';
    return `z.array(${zodType(first, ind)})`;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return 'z.object({})';
  const body = keys.map((k) => `${pad}  ${JSON.stringify(k)}: ${zodType(value[k]!, ind + 1)},`).join('\n');
  return `z.object({\n${body}\n${pad}})`;
}

function countFields(v: Json): number {
  if (v === null || typeof v !== 'object') return 0;
  let n = 0;
  if (Array.isArray(v)) {
    for (const el of v) n += countFields(el);
    return n;
  }
  for (const key of Object.keys(v)) {
    n += 1;
    n += countFields(v[key] as Json);
  }
  return n;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const variable = String(o.variable ?? 'schema').trim() || 'schema';

  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError('Paste a JSON object or array.', 'A single JSON value; its shape becomes the schema.');
  }

  let parsed: Json;
  try {
    parsed = JSON.parse(text) as Json;
  } catch (e) {
    throw new ToolError(`Invalid JSON: ${(e as Error).message}`, 'Check quotes, commas and brackets.');
  }

  const schema = zodType(parsed, 0);
  const output = `import { z } from 'zod';\n\nconst ${variable} = ${schema};\n\nexport { ${variable} };\n`;

  return {
    output,
    render: 'code',
    stats: { fields: countFields(parsed), topLevel: Array.isArray(parsed) ? 0 : 1 },
    notes: [
      'Copy the generated code into your project; tighten it with .optional(), .nullable() or .int() as needed.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
