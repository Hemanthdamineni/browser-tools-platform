import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './jsdoc-generator.meta';

const MAX_LEN = 10_000;

/** Split a parameter list on commas outside any brackets/parens/braces. */
function splitParams(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    cur += ch;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter(Boolean);
}

function paramName(param: string): string {
  let p = param.split(/\/\//)[0]!.trim();
  p = p.replace(/^\.\.\./, '').replace(/^this\s*/, '');
  const m = /^([A-Za-z_$][\w$]*)/.exec(p);
  if (m) return m[1]!;
  const clean = p.replace(/[{}[\]]/g, '');
  const m2 = /^([A-Za-z_$][\w$]*)/.exec(clean.trim());
  return m2 ? m2[1]! : (clean.trim().slice(0, 16) || 'arg');
}

function parseSignature(source: string): { name: string | null; params: string[] } {
  let t = source.trim();
  t = t
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .join(' ');
  const arrowless = t.replace(/=>[\s\S]*$/, '').trim();
  const norm = arrowless.replace(/^(?:const|let|var)\s+/, '').trim();

  let name: string | null = null;
  let paramsText: string | null = null;

  // Arrow: const f = (a, b) => …   |   const f = a => …
  const arrow = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\(([\s\S]*?)\)|([A-Za-z_$][\w$]*))(?:\s*=>)?/.exec(arrowless);
  if (arrow) {
    name = arrow[1]!;
    paramsText = arrow[2] ?? arrow[3] ?? '';
  } else {
    // Function declaration or shorthand: [async] [function] name(params)
    const fn = /^(?:async\s+)?(?:function\s+)?([A-Za-z_$][\w$]*)?\s*\(([\s\S]*?)\)/.exec(norm);
    if (fn) {
      name = fn[1] || null;
      paramsText = fn[2] ?? '';
    } else {
      throw new ToolError('Could not find a function signature.', 'Examples: function fetchUser(id) { … }, const f = (x) => …');
    }
  }

  return { name, params: splitParams(paramsText) };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const withDescription = o.description !== false;
  const source = (input.text ?? '').trim();
  if (!source) throw new ToolError('Paste a function signature to generate JSDoc for.');
  if (source.length > MAX_LEN) throw new ToolError('Input is too large.');

  const { name, params } = parseSignature(source);
  const lines: string[] = ['/**'];
  if (withDescription) lines.push(' * ' + (name ? 'Describe what `' + name + '` does.' : 'Describe what this function does.'));
  for (const p of params) lines.push(' * @param ' + paramName(p) + ' - ');
  lines.push(' * @returns ');
  lines.push(' */');

  return {
    output: lines.join('\n') + '\n',
    render: 'code',
    language: 'js',
    stats: { parameters: params.length },
    notes: [
      'Fill in each description after " - ".',
      params.some((p) => /\{|\[/.test(p)) ? 'Destructured parameter detected — expand @property lines as needed.' : '',
    ].filter(Boolean),
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
