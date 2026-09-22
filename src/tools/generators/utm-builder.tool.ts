import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './utm-builder.meta';

const KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const base = input.text.trim();
  if (!base) return { output: '' };
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ToolError('That is not a valid URL.', 'Include the scheme, e.g. https://');
  }

  const lowercase = Boolean(o.lowercase);
  if (o.stripExisting) {
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    }
  }
  const applied: [string, string][] = [];
  for (const k of KEYS) {
    let v = String(o[k] ?? '').trim();
    if (!v) continue;
    if (lowercase) v = v.toLowerCase();
    url.searchParams.set(`utm_${k}`, v);
    applied.push([`utm_${k}`, v]);
  }

  const missing = (['source', 'medium', 'campaign'] as const).filter(
    (k) => !String(o[k] ?? '').trim(),
  );
  const warnings = missing.length
    ? [
        `Missing ${missing.map((m) => `utm_${m}`).join(', ')} — Google Analytics recommends source, medium and campaign.`,
      ]
    : undefined;

  const breakdown = applied.map(([k, v]) => `${k} = ${v}`).join('\n');
  return {
    output: `${url.toString()}\n\n${breakdown}`,
    render: 'text',
    filename: 'utm-url.txt',
    warnings,
    stats: { parameters: applied.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
