import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './yaml-lint.meta';

const MAX_LENGTH = 1_000_000;

interface Diag {
  line: number;
  col: number;
  message: string;
}

interface LineX {
  indent: number;
  content: string;
  line: number;
  col: number;
}

type NodeKind = 'map' | 'seq' | 'scalar' | 'flow' | 'block';

interface MapEntryNode {
  key: string;
  value: Node;
  line: number;
  col: number;
}

interface Node {
  kind: NodeKind;
  entries?: MapEntryNode[];
  items?: Node[];
  value?: string;
  header?: string;
  body?: string;
  typed?: boolean;
  quoted?: boolean;
}

function mk(p: Partial<Node> & { kind: NodeKind }): Node {
  return { ...p } as Node;
}

interface Parser {
  diags: Diag[];
}

function pushDiag(p: Parser, line: number, col: number, message: string): void {
  p.diags.push({ line, col, message });
}

/**
 * A quote only opens a string after a structural boundary; an apostrophe inside a
 * plain scalar (it's) is data, not the start of a quoted string.
 */
function isQuoteStart(text: string, i: number): boolean {
  const ch = text[i];
  if (ch !== "'" && ch !== '"') return false;
  if (i === 0) return true;
  const prev = text[i - 1]!;
  return (
    prev === ' ' ||
    prev === '\t' ||
    prev === ':' ||
    prev === ',' ||
    prev === '[' ||
    prev === '{' ||
    prev === '-' ||
    prev === '|' ||
    prev === '>'
  );
}

/** Build logical lines, merging multi-line quoted scalars and flow collections. */
function buildLines(text: string): { lines: LineX[]; diagnostics: Diag[] } {
  const diagnostics: Diag[] = [];
  const physical = text.split('\n');
  const lines: LineX[] = [];
  let pendingIndent = 0;
  let pendingContent = '';
  let pendingLine = 1;
  let pendingCol = 1;
  let quoteState: 'none' | 'single' | 'double' = 'none';
  let flowOpen = false;

  const scan = (): void => {
    let q: 'none' | 'single' | 'double' = 'none';
    let inComment = false;
    let flow = false;
    for (let i = 0; i < pendingContent.length; i++) {
      const ch = pendingContent[i]!;
      if (inComment) continue;
      if (q === 'single') {
        if (ch === "'") {
          if (pendingContent[i + 1] === "'") i += 1;
          else q = 'none';
        }
        continue;
      }
      if (q === 'double') {
        if (ch === '\\') i += 1;
        else if (ch === '"') q = 'none';
        continue;
      }
      if (
        ch === '#' &&
        (i === 0 || pendingContent[i - 1] === ' ' || pendingContent[i - 1] === '\t')
      ) {
        inComment = true;
        continue;
      }
      if (isQuoteStart(pendingContent, i)) {
        if (ch === "'") q = 'single';
        else q = 'double';
      } else if (ch === '[' || ch === '{') flow = true;
      else if (ch === ']' || ch === '}') flow = false;
    }
    quoteState = q;
    flowOpen = flow;
  };

  const flush = (): void => {
    if (pendingContent === '' || pendingContent.trim() === '') {
      pendingContent = '';
      return;
    }
    lines.push({
      indent: pendingIndent,
      content: pendingContent,
      line: pendingLine,
      col: pendingCol,
    });
    pendingContent = '';
    quoteState = 'none';
    flowOpen = false;
  };

  for (let p = 0; p < physical.length; p++) {
    const raw = physical[p]!;
    const leading = /^[ \t]*/.exec(raw)?.[0] ?? '';
    const indent = leading.length;
    const content = raw.slice(leading.length);
    if (leading.includes('\t')) {
      diagnostics.push({
        line: p + 1,
        col: 1,
        message: 'Tabs are not allowed for indentation; use spaces.',
      });
    }
    if (quoteState === 'none' && !flowOpen) {
      flush();
      pendingIndent = indent;
      pendingLine = p + 1;
      pendingCol = 1 + leading.length;
      pendingContent = content;
    } else {
      pendingContent += '\n' + content;
    }
    scan();
  }

  const endQuote = quoteState;
  const endFlow = flowOpen;
  flush();

  if (endQuote !== 'none') {
    diagnostics.push({
      line: pendingLine,
      col: pendingCol,
      message: `Unclosed ${endQuote === 'single' ? "single '" : 'double "'} quote at end of document.`,
    });
  } else if (endFlow) {
    diagnostics.push({
      line: pendingLine,
      col: pendingCol,
      message: 'Unclosed flow collection ([ or {) at end of document.',
    });
  }
  return { lines, diagnostics };
}

function decodeEscape(e: string): string {
  switch (e) {
    case 'n':
      return '\n';
    case 't':
      return '\t';
    case 'r':
      return '\r';
    case 'b':
      return '\b';
    case 'f':
      return '\f';
    case '0':
      return '\0';
    case '\\':
      return '\\';
    case '"':
      return '"';
    default:
      return e;
  }
}

function unquote(raw: string): { value: string; quoted: boolean } {
  const t = raw.trim();
  if (t.length >= 2 && t[0] === "'" && t[t.length - 1] === "'") {
    return { value: t.slice(1, -1).replace(/''/g, "'"), quoted: true };
  }
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') {
    return {
      value: t.slice(1, -1).replace(/\\(["\\nrtubf0])/g, (_m, e: string) => decodeEscape(e)),
      quoted: true,
    };
  }
  return { value: t, quoted: false };
}

/** Remove a trailing " # comment" outside quotes (only when preceded by a space/tab). */
function stripComment(raw: string): string {
  let q: 'none' | 'single' | 'double' = 'none';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (q === 'single') {
      if (ch === "'") {
        if (raw[i + 1] === "'") i += 1;
        else q = 'none';
      }
      continue;
    }
    if (q === 'double') {
      if (ch === '\\') i += 1;
      else if (ch === '"') q = 'none';
      continue;
    }
    if (isQuoteStart(raw, i)) {
      if (ch === "'") q = 'single';
      else q = 'double';
    } else if (ch === '#' && i > 0 && (raw[i - 1] === ' ' || raw[i - 1] === '\t'))
      return raw.slice(0, i).trimEnd();
  }
  return raw.trimEnd();
}

/** Find "key: value" separator (colon followed by space/end, outside quotes/flow). */
function splitKV(line: string): { keyRaw: string; rest: string } | null {
  let q: 'none' | 'single' | 'double' = 'none';
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q === 'single') {
      if (ch === "'") {
        if (line[i + 1] === "'") i += 1;
        else q = 'none';
      }
      continue;
    }
    if (q === 'double') {
      if (ch === '\\') i += 1;
      else if (ch === '"') q = 'none';
      continue;
    }
    if (isQuoteStart(line, i)) {
      if (ch === "'") q = 'single';
      else q = 'double';
    } else if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth -= 1;
    else if (
      ch === ':' &&
      depth <= 0 &&
      (line[i + 1] === ' ' || line[i + 1] === '\t' || i === line.length - 1)
    ) {
      return { keyRaw: line.slice(0, i).trim(), rest: line.slice(i + 1).trim() };
    }
  }
  return null;
}

function parseScalar(raw: string): Node {
  const t = stripComment(raw).trim();
  if (t.startsWith('[') || t.startsWith('{')) return mk({ kind: 'flow', value: t });
  if (t.length >= 2 && (t[0] === "'" || t[0] === '"') && t[t.length - 1] === t[0]) {
    return mk({ kind: 'scalar', value: unquote(t).value, quoted: true });
  }
  if (/^[|>](?:[-+])?(?:\d+)?[+-]?$/.test(t)) return mk({ kind: 'block', header: t, body: '' });
  const typed =
    /^(?:true|false|null|~)$/i.test(t) || /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(t);
  return mk({ kind: 'scalar', value: t, typed, quoted: false });
}

function collectBlockBody(
  lines: LineX[],
  i: number,
  parentIndent: number,
): { body: string; next: number } {
  const parts: string[] = [];
  let j = i;
  while (j < lines.length && lines[j]!.indent > parentIndent) {
    parts.push(lines[j]!.content);
    j += 1;
  }
  return { body: parts.join('\n'), next: j };
}

function parseValue(
  p: Parser,
  lines: LineX[],
  i: number,
  parentIndent: number,
  rawRest: string,
): { node: Node; next: number } {
  const trimmed = rawRest.trim();
  if (trimmed !== '') {
    const node = parseScalar(trimmed);
    if (node.kind === 'block') {
      const col = collectBlockBody(lines, i, parentIndent);
      const blk = mk({ kind: 'block', header: node.header as string, body: col.body });
      return { node: blk, next: col.next };
    }
    if (node.kind === 'flow' && !isBalancedFlow(node.value as string)) {
      pushDiag(
        p,
        pendingLineOf(lines, i),
        1,
        'Unclosed flow collection in the middle of the document.',
      );
    }
    return { node, next: i };
  }
  const parsed = parseBlock(p, lines, i, parentIndent);
  if (parsed.node) return { node: parsed.node, next: parsed.next };
  return { node: mk({ kind: 'scalar', value: '' }), next: i };
}

function pendingLineOf(lines: LineX[], i: number): number {
  return lines.length > i ? lines[i]!.line : 1;
}

function isBalancedFlow(value: string): boolean {
  let depth = 0;
  let q: 'none' | 'single' | 'double' = 'none';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (q === 'single') {
      if (ch === "'") {
        if (value[i + 1] === "'") i += 1;
        else q = 'none';
      }
      continue;
    }
    if (q === 'double') {
      if (ch === '\\') i += 1;
      else if (ch === '"') q = 'none';
      continue;
    }
    if (isQuoteStart(value, i)) {
      if (ch === "'") q = 'single';
      else q = 'double';
    } else if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth -= 1;
  }
  return depth === 0 && q === 'none';
}

function parseSeq(
  p: Parser,
  lines: LineX[],
  i: number,
  parentIndent: number,
): { node: Node; next: number } {
  const items: Node[] = [];
  let j = i;
  while (j < lines.length) {
    const line = lines[j]!;
    if (line.indent <= parentIndent) break;
    const isDash = line.content.startsWith('-') && /^-(?:\s|$)/.test(line.content);
    if (!isDash) {
      const sub = parseBlock(p, lines, j, parentIndent - 1);
      if (sub.node) {
        items.push(sub.node);
        j = sub.next;
        continue;
      }
      break;
    }
    const rest = line.content.slice(1).trim();
    if (rest === '') {
      const sub = parseBlock(p, lines, j + 1, line.indent);
      if (sub.node) {
        items.push(sub.node);
        j = sub.next;
        continue;
      }
      j += 1;
      continue;
    }
    const kv = splitKV(rest);
    if (kv) {
      const parsed = parseValue(p, lines, j + 1, line.indent, kv.rest);
      const entries: MapEntryNode[] = [
        {
          key: unquote(kv.keyRaw).value,
          value: parsed.node,
          line: line.line,
          col: 1 + line.indent,
        },
      ];
      let k = parsed.next;
      // Consume continuation "key: value" lines that belong to this same compact map.
      while (k < lines.length) {
        const cont = lines[k]!;
        if (cont.indent <= line.indent) break;
        if (cont.content.startsWith('-') && /^-(?:\s|$)/.test(cont.content)) break;
        const ckv = splitKV(cont.content);
        if (!ckv) break;
        const cparsed = parseValue(p, lines, k + 1, cont.indent, ckv.rest);
        entries.push({
          key: unquote(ckv.keyRaw).value,
          value: cparsed.node,
          line: cont.line,
          col: 1 + cont.indent,
        });
        k = cparsed.next;
      }
      items.push(mk({ kind: 'map', entries }));
      j = k;
      continue;
    }
    const parsed = parseValue(p, lines, j + 1, line.indent, rest);
    items.push(parsed.node);
    j = parsed.next;
  }
  return { node: mk({ kind: 'seq', items }), next: j };
}

function parseBlock(
  p: Parser,
  lines: LineX[],
  i: number,
  parentIndent: number,
): { node: Node | null; next: number } {
  if (i >= lines.length) return { node: null, next: i };
  const first = lines[i]!;
  if (first.indent <= parentIndent) return { node: null, next: i };
  const blockIndent = first.indent;
  if (first.content.startsWith('-') && /^-(?:\s|$)/.test(first.content)) {
    return parseSeq(p, lines, i, parentIndent);
  }
  const entries: MapEntryNode[] = [];
  const seen = new Map<string, number>();
  let j = i;
  while (j < lines.length) {
    const line = lines[j]!;
    if (line.indent !== blockIndent) break;
    const kv = splitKV(line.content);
    if (!kv) {
      pushDiag(p, line.line, 1 + line.indent, 'Expected "key: value" in a mapping block.');
      j += 1;
      continue;
    }
    const keyInfo = unquote(kv.keyRaw);
    const parsed = parseValue(p, lines, j + 1, blockIndent, kv.rest);
    entries.push({ key: keyInfo.value, value: parsed.node, line: line.line, col: 1 + line.indent });
    if (seen.has(keyInfo.value)) {
      pushDiag(
        p,
        line.line,
        1 + line.indent,
        `Duplicate key "${keyInfo.value}" (already defined on line ${seen.get(keyInfo.value)}).`,
      );
    } else {
      seen.set(keyInfo.value, line.line);
    }
    j = parsed.next;
  }
  return { node: mk({ kind: 'map', entries }), next: j };
}

const LEADING_AMBIGUOUS = ' \t"' + "'" + '#-?:,{}[]';

function needsPlainStringQuote(raw: string): boolean {
  if (raw === '') return true;
  if (LEADING_AMBIGUOUS.includes(raw[0] ?? '')) return true;
  if (/[:#](?:\s|$)/.test(raw) || /^\s|\s$/.test(raw)) return true;
  if (/[\n\r\t]/.test(raw)) return true;
  return false;
}

function needsQuotes(raw: string): boolean {
  if (raw === '') return true;
  if (/^(?:true|false|null|~|yes|no|on|off|y|n)$/i.test(raw)) return true;
  if (/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(raw)) return true;
  if (LEADING_AMBIGUOUS.includes(raw[0] ?? '')) return true;
  if (/[:#](?:\s|$)/.test(raw) || /^\s|\s$/.test(raw)) return true;
  if (/[\n\r\t]/.test(raw)) return true;
  return false;
}

function quoteValue(raw: string): string {
  const escaped = raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return '"' + escaped + '"';
}

function render(node: Node, indentStr: string, depth: number): string[] {
  const pad = (d: number): string => indentStr.repeat(d);
  const out: string[] = [];
  if (node.kind === 'scalar') {
    const value = (node.value as string) ?? '';
    if (value === '') return ['{}'];
    if (node.quoted) return [needsQuotes(value) ? quoteValue(value) : value];
    if (node.typed) {
      // Native value: only the YAML 1.1 ambiguous keywords need quoting.
      return /^(?:yes|no|on|off|y|n)$/i.test(value) ? [quoteValue(value)] : [value];
    }
    return [needsPlainStringQuote(value) ? quoteValue(value) : value];
  }
  if (node.kind === 'flow') return [node.value as string];
  if (node.kind === 'block') {
    const header = (node.header as string) || '|';
    const body =
      (node.body as string) === ''
        ? []
        : (node.body as string).split('\n').map((l) => pad(depth + 1) + l);
    return [header, ...body];
  }
  if (node.kind === 'map') {
    for (const e of node.entries as MapEntryNode[]) {
      const key = needsQuotes(e.key) ? quoteValue(e.key) : e.key;
      if (e.value.kind === 'map' || e.value.kind === 'seq') {
        out.push(pad(depth) + key + ':');
        out.push(...render(e.value, indentStr, depth + 1));
      } else if (e.value.kind === 'block') {
        const header = (e.value.header as string) || '|';
        const body =
          (e.value.body as string) === ''
            ? []
            : (e.value.body as string).split('\n').map((l) => pad(depth + 1) + l);
        out.push(pad(depth) + key + ': ' + header);
        out.push(...body);
      } else {
        out.push(pad(depth) + key + ': ' + render(e.value, indentStr, 0)[0]!);
      }
    }
    return out;
  }
  // sequence
  for (const item of node.items as Node[]) {
    if (item.kind === 'map' && (item.entries as MapEntryNode[]).length > 0) {
      const entries = item.entries as MapEntryNode[];
      const first = entries[0]!;
      const key = needsQuotes(first.key) ? quoteValue(first.key) : first.key;
      const sim = !(
        first.value.kind === 'map' ||
        first.value.kind === 'seq' ||
        first.value.kind === 'block'
      );
      const valText = render(first.value, indentStr, depth + 1);
      if (sim) {
        out.push(pad(depth) + '- ' + key + ': ' + valText[0]!);
      } else {
        out.push(pad(depth) + '- ' + key + ': ');
        out.push(...valText.map((l) => pad(depth + 1) + l));
      }
      for (let k = 1; k < entries.length; k++) {
        const e = entries[k]!;
        const eKey = needsQuotes(e.key) ? quoteValue(e.key) : e.key;
        if (e.value.kind === 'map' || e.value.kind === 'seq') {
          out.push(pad(depth + 1) + eKey + ':');
          out.push(...render(e.value, indentStr, depth + 2));
        } else if (e.value.kind === 'block') {
          const body =
            (e.value.body as string) === ''
              ? []
              : (e.value.body as string).split('\n').map((l) => pad(depth + 2) + l);
          out.push(pad(depth + 1) + eKey + ': ' + ((e.value.header as string) || '|'));
          out.push(...body);
        } else {
          out.push(pad(depth + 1) + eKey + ': ' + render(e.value, indentStr, 0)[0]!);
        }
      }
    } else if (item.kind === 'map') {
      out.push(pad(depth) + '- {}');
    } else if (item.kind === 'scalar' || item.kind === 'flow' || item.kind === 'block') {
      if (item.kind === 'block') {
        const body =
          (item.body as string) === ''
            ? []
            : (item.body as string).split('\n').map((l) => pad(depth + 1) + l);
        out.push(pad(depth) + '- ' + ((item.header as string) || '|'));
        out.push(...body);
      } else {
        out.push(pad(depth) + '- ' + render(item, indentStr, depth)[0]!);
      }
    } else {
      out.push(pad(depth) + '-');
      out.push(...render(item, indentStr, depth + 1));
    }
  }
  return out;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const normalize = o.normalize !== false;
  const indent = Number(o.indent ?? 2);
  if (![2, 3, 4, 6, 8].includes(indent)) {
    throw new ToolError('Indent must be one of 2, 3, 4, 6 or 8 spaces.');
  }
  const source = input.text ?? '';
  if (!source.trim()) {
    throw new ToolError(
      'Paste a YAML document to lint.',
      'Example:\nserver:\n  host: localhost\n  port: 8080',
    );
  }
  if (source.length > MAX_LENGTH) {
    throw new ToolError('The document is too large.', 'Keep it under 1,000,000 characters.');
  }

  const built = buildLines(source);
  const p: Parser = { diags: [...built.diagnostics] };

  // Report constructs this focused parser does not resolve, rather than misreading them.
  for (const line of built.lines) {
    const text = line.content;
    if (/^(?:---|\.\.\.)$/.test(text.trim())) {
      pushDiag(
        p,
        line.line,
        1,
        'Multi-document stream marker: only the first document is analyzed.',
      );
    } else if (/(?:^|\s)[&*][A-Za-z0-9_-]+/.test(text)) {
      pushDiag(
        p,
        line.line,
        1 + line.indent,
        'Anchors and aliases are not supported; this reference is left as written.',
      );
    } else if (/(?:^|\s)![A-Za-z!<]/.test(text)) {
      pushDiag(
        p,
        line.line,
        1 + line.indent,
        'Explicit tags (!) are not supported and are left as written.',
      );
    }
  }

  let root: Node | null = null;
  if (built.lines.length > 0) {
    const first = built.lines[0]!;
    if (first.content.startsWith('-') && /^-(?:\s|$)/.test(first.content)) {
      root = parseSeq(p, built.lines, 0, -1).node;
    } else {
      const kv = splitKV(first.content);
      if (kv) {
        root = parseBlock(p, built.lines, 0, -1).node;
      } else if (built.lines.length === 1) {
        root = parseScalar(first.content);
      } else {
        pushDiag(
          p,
          first.line,
          1,
          'Expected "key: value" or a "- " sequence at the start of the document.',
        );
      }
    }
  }

  const all = [...p.diags];
  const errors = all.filter((d) => /Unclosed|Expected|Tabs|flow collection/.test(d.message));
  const warnings = all.filter((d) => !errors.includes(d));

  let output: string;
  let renderMode: 'code' | 'table';
  if (errors.length === 0 && warnings.length === 0 && normalize && root) {
    output = render(root, ' '.repeat(indent), 0).join('\n') + '\n';
    renderMode = 'code';
  } else if (errors.length === 0 && warnings.length === 0) {
    output = 'No issues found.';
    renderMode = 'code';
  } else {
    const rows = all.map((d) => [
      String(d.line),
      String(d.col),
      errors.includes(d) ? 'error' : 'warning',
      d.message,
    ]);
    output = JSON.stringify({ headers: ['Line', 'Col', 'Severity', 'Message'], rows });
    renderMode = 'table';
  }

  return {
    output,
    render: renderMode,
    language: 'yaml',
    stats: { errors: errors.length, warnings: warnings.length },
    notes:
      all.length === 0
        ? ['Document is well-formed and was normalized.']
        : [
            `Found ${errors.length} error(s) and ${warnings.length} warning(s); fix them to see normalized output.`,
          ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
