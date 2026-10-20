import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './css-variables-extractor.meta';

const MAX_LEN = 500_000;

interface Decl {
  name: string;
  value: string;
  scope: string;
}

/** Strip CSS comments while preserving line structure. */
function stripComments(css: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < css.length) {
    const ch = css[i]!;
    if (quote !== null) {
      out += ch;
      if (ch === '\\' && i + 1 < css.length) {
        out += css[i + 1]!;
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) {
        if (css[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Walk the stylesheet tracking the current selector scope and at-rule context.
 * Handles nested blocks, quoted strings and parentheses inside values.
 */
function extract(css: string): Decl[] {
  const decls: Decl[] = [];
  const stack: string[] = [];
  let buffer = '';
  let quote: string | null = null;
  let paren = 0;

  const flush = (): void => {
    const segment = buffer.trim();
    buffer = '';
    if (segment === '') return;

    if (segment.startsWith('@')) {
      // At-rules with blocks push a context; blockless at-rules (@import …;) are ignored.
      stack.push(segment.replace(/\s+/g, ' '));
      return;
    }

    // A block segment like ".theme-dark" opens a selector scope.
    stack.push(segment.replace(/\s+/g, ' '));
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;

    if (quote !== null) {
      buffer += ch;
      if (ch === '\\' && i + 1 < css.length) {
        buffer += css[i + 1]!;
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buffer += ch;
      continue;
    }
    if (ch === '(') {
      paren += 1;
      buffer += ch;
      continue;
    }
    if (ch === ')') {
      paren = Math.max(0, paren - 1);
      buffer += ch;
      continue;
    }

    if (ch === '{') {
      flush();
      continue;
    }

    if (ch === '}') {
      const segment = buffer.trim();
      buffer = '';
      if (segment !== '') {
        // A declaration at the end of a block without a trailing semicolon.
        record(segment);
      }
      stack.pop();
      continue;
    }

    if (ch === ';' && paren === 0) {
      const segment = buffer.trim();
      buffer = '';
      if (segment !== '') record(segment);
      continue;
    }

    buffer += ch;
  }

  function record(segment: string): void {
    if (!segment.startsWith('--')) return;
    const colon = segment.indexOf(':');
    if (colon === -1) return;
    const name = segment.slice(0, colon).trim();
    const value = segment
      .slice(colon + 1)
      .trim()
      .replace(/\s+/g, ' ');
    if (!/^--[\w-]+$/.test(name)) return;
    const scopeParts = stack.filter((s) => s !== '');
    const scope = scopeParts.length > 0 ? scopeParts.join(' > ') : '(top level)';
    decls.push({ name, value, scope });
  }

  // Trailing buffer (rare, malformed CSS) — record if it looks like a declaration.
  const tail = buffer.trim();
  if (tail.startsWith('--')) record(tail);

  return decls;
}

interface Group {
  name: string;
  declarations: { value: string; scope: string }[];
}

function groupDecls(decls: Decl[], dedupe: boolean): Group[] {
  if (!dedupe) {
    return decls.map((d) => ({ name: d.name, declarations: [{ value: d.value, scope: d.scope }] }));
  }
  const map = new Map<string, Group>();
  const order: string[] = [];
  for (const d of decls) {
    let group = map.get(d.name);
    if (!group) {
      group = { name: d.name, declarations: [] };
      map.set(d.name, group);
      order.push(d.name);
    }
    group.declarations.push({ value: d.value, scope: d.scope });
  }
  return order.map((name) => map.get(name)!);
}

function toJson(groups: Group[], nested: boolean): string {
  const obj: Record<string, unknown> = {};
  for (const g of groups) {
    if (!nested || g.declarations.length === 1) {
      obj[g.name] = g.declarations[0]!.value;
    } else {
      obj[g.name] = g.declarations.map((d) => ({ value: d.value, scope: d.scope }));
    }
  }
  return JSON.stringify(obj, null, 2);
}

function toScss(groups: Group[], keepComments: boolean): string {
  const lines: string[] = [];
  for (const g of groups) {
    if (keepComments && g.declarations.length > 1) {
      lines.push(
        '// ' + g.name + ' — ' + g.declarations.length + ' declarations (last wins in CSS)',
      );
    }
    const last = g.declarations[g.declarations.length - 1]!;
    const scssName = g.name.replace(/^--/, '');
    lines.push('$' + scssName + ': ' + last.value + ';');
  }
  return lines.join('\n');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = String(o.output ?? 'table');
  const includeComments = o.includeComments === true;
  const dedupe = o.dedupe !== false;

  const raw = String(input.text ?? '');
  if (raw.trim() === '')
    throw new ToolError('Paste a stylesheet containing CSS custom properties.');
  if (raw.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');

  const decls = extract(stripComments(raw));
  if (decls.length === 0) {
    throw new ToolError(
      'No CSS custom properties found.',
      'Declarations look like --name: value; inside a rule block.',
    );
  }

  const groups = groupDecls(decls, dedupe);
  const uniqueNames = new Set(decls.map((d) => d.name));
  const scopes = new Set(decls.map((d) => d.scope));
  const notes = [
    decls.length +
      ' declaration(s), ' +
      uniqueNames.size +
      ' unique variable(s), ' +
      scopes.size +
      ' scope(s).',
  ];

  if (format === 'table') {
    const rows: string[][] = [];
    for (const g of groups) {
      if (g.declarations.length === 1) {
        rows.push([g.name, g.declarations[0]!.value, g.declarations[0]!.scope]);
      } else {
        for (const d of g.declarations) rows.push([g.name, d.value, d.scope]);
      }
    }
    return {
      output: JSON.stringify({ headers: ['Variable', 'Value', 'Scope'], rows }),
      render: 'table',
      stats: { declarations: decls.length, variables: uniqueNames.size },
      notes,
    };
  }

  if (format === 'json') {
    return {
      output: toJson(groups, !dedupe) + '\n',
      render: 'text',
      language: 'json',
      stats: { declarations: decls.length, variables: uniqueNames.size },
      notes,
    };
  }

  if (format === 'js') {
    return {
      output: 'export const cssVariables = ' + toJson(groups, !dedupe) + ';\n',
      render: 'text',
      language: 'javascript',
      stats: { declarations: decls.length, variables: uniqueNames.size },
      notes,
    };
  }

  return {
    output: toScss(groups, includeComments) + '\n',
    render: 'text',
    language: 'scss',
    stats: { declarations: decls.length, variables: uniqueNames.size },
    notes: notes.concat('SCSS uses the last declaration per variable — overrides collapse.'),
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
