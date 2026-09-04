import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './xml-format.meta';

type TokenType = 'open' | 'close' | 'selfclose' | 'text' | 'comment' | 'cdata' | 'pi' | 'decl';

interface Token {
  type: TokenType;
  raw: string;
  name?: string;
}

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i]!;
    if (ch !== '<') {
      const nextLt = src.indexOf('<', i);
      const end = nextLt === -1 ? n : nextLt;
      tokens.push({ type: 'text', raw: src.slice(i, end) });
      i = end;
      continue;
    }

    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) throw new ToolError('Unterminated comment.', 'Missing "-->".');
      tokens.push({ type: 'comment', raw: src.slice(i, end + 3) });
      i = end + 3;
      continue;
    }

    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9);
      if (end === -1) throw new ToolError('Unterminated CDATA section.', 'Missing "]]>".');
      tokens.push({ type: 'cdata', raw: src.slice(i, end + 3) });
      i = end + 3;
      continue;
    }

    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      if (end === -1) throw new ToolError('Unterminated processing instruction.', 'Missing "?>".');
      tokens.push({ type: 'pi', raw: src.slice(i, end + 2) });
      i = end + 2;
      continue;
    }

    if (src.startsWith('<!', i)) {
      let j = i + 2;
      let depth = 0;
      while (j < n) {
        const c = src[j]!;
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth <= 0) break;
        j++;
      }
      if (j >= n) throw new ToolError('Unterminated declaration.', 'Missing ">".');
      tokens.push({ type: 'decl', raw: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // A normal tag. Scan to the closing '>', respecting quoted attribute values.
    let j = i + 1;
    let quote: string | null = null;
    while (j < n) {
      const c = src[j]!;
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '<') {
        throw new ToolError(
          'Malformed markup: unexpected "<" inside a tag.',
          `Near "${src.slice(i, j + 1)}".`,
        );
      } else if (c === '>') {
        break;
      }
      j++;
    }
    if (j >= n) throw new ToolError('Unterminated tag.', 'Missing ">".');

    const raw = src.slice(i, j + 1);
    let body = src.slice(i + 1, j).trim();
    let type: TokenType = 'open';
    if (body.startsWith('/')) {
      type = 'close';
      body = body.slice(1).trim();
    } else if (body.endsWith('/')) {
      type = 'selfclose';
      body = body.slice(0, -1).trim();
    }
    const name = body.split(/[\s/]/)[0] ?? '';
    if (!NAME_RE.test(name)) {
      throw new ToolError(`Malformed tag: "${raw}".`, 'The tag name is missing or invalid.');
    }
    tokens.push({ type, raw, name });
    i = j + 1;
  }

  return tokens;
}

function collectWarnings(tokens: Token[]): string[] {
  const stack: string[] = [];
  const warnings: string[] = [];
  for (const t of tokens) {
    if (t.type === 'open') {
      stack.push(t.name!);
    } else if (t.type === 'close') {
      if (stack.length > 0 && stack[stack.length - 1] === t.name) {
        stack.pop();
      } else {
        warnings.push(`Unbalanced tag: unexpected </${t.name}>.`);
        const idx = stack.lastIndexOf(t.name!);
        if (idx !== -1) while (stack.length > idx) stack.pop();
      }
    }
  }
  if (stack.length > 0) {
    warnings.push(
      `Unclosed tag${stack.length > 1 ? 's' : ''}: ${stack.map((x) => `<${x}>`).join(', ')}.`,
    );
  }
  return warnings;
}

const collapseWs = (s: string) => s.replace(/\s+/g, ' ');

function minify(tokens: Token[]): string {
  const out: string[] = [];
  for (const t of tokens) {
    if (t.type === 'text') {
      if (t.raw.trim() === '') continue;
      out.push(t.raw);
    } else {
      out.push(t.raw);
    }
  }
  return out.join('');
}

function pretty(tokens: Token[], unit: string): string {
  const lines: string[] = [];
  const stack: string[] = [];
  const pad = () => unit.repeat(stack.length);

  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]!;

    if (t.type === 'text') {
      const trimmed = t.raw.trim();
      if (trimmed === '') continue;
      lines.push(pad() + collapseWs(trimmed));
      continue;
    }

    if (t.type === 'open') {
      const n1 = tokens[k + 1];
      const n2 = tokens[k + 2];
      if (
        n1 &&
        n1.type === 'text' &&
        n1.raw.trim() !== '' &&
        n2 &&
        n2.type === 'close' &&
        n2.name === t.name
      ) {
        lines.push(pad() + t.raw + collapseWs(n1.raw.trim()) + n2.raw);
        k += 2;
        continue;
      }
      lines.push(pad() + t.raw);
      stack.push(t.name!);
      continue;
    }

    if (t.type === 'close') {
      if (stack.length > 0 && stack[stack.length - 1] === t.name) {
        stack.pop();
      } else {
        const idx = stack.lastIndexOf(t.name!);
        if (idx !== -1) while (stack.length > idx) stack.pop();
      }
      lines.push(pad() + t.raw);
      continue;
    }

    // selfclose, comment, cdata, pi, decl
    lines.push(pad() + t.raw);
  }

  return lines.join('\n');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const tokens = tokenize(input.text);
  const warnings = collectWarnings(tokens);

  const unit = o.indent === 'tab' ? '\t' : o.indent === '4' ? '    ' : '  ';
  const output = o.operation === 'minify' ? minify(tokens) : pretty(tokens, unit);

  return {
    output,
    render: 'code',
    language: 'xml',
    filename: 'formatted.xml',
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { 'input chars': input.text.length, 'output chars': output.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
