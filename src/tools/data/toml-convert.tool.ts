import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './toml-convert.meta';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const HEX_RE = /^[+-]?0x[0-9A-Fa-f]+$/;
const OCT_RE = /^[+-]?0o[0-7]+$/;
const BIN_RE = /^[+-]?0b[01]+$/;
const INT_RE = /^[+-]?[0-9]+$/;
const FLOAT_RE = /^[+-]?(?:[0-9]+\.[0-9]*|\.[0-9]+|[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?$/;
const TIME_RE = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const BARE_KEY_RE = /^[A-Za-z0-9_-]+$/;

function isPlainObject(v: Json): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class TomlParser {
  private src: string;
  private i = 0;
  private line = 1;
  private root: Obj = {};
  private current: Obj = this.root;

  constructor(src: string) {
    this.src = src;
  }

  private peek(k = 0): string {
    return this.src[this.i + k] ?? '';
  }

  private eof(): boolean {
    return this.i >= this.src.length;
  }

  private err(msg: string): never {
    throw new ToolError(`TOML line ${this.line}: ${msg}`);
  }

  private skipWs(): void {
    while (!this.eof() && (this.peek() === ' ' || this.peek() === '\t')) this.i++;
  }

  private skipNewlines(): void {
    while (!this.eof() && (this.peek() === '\n' || this.peek() === '\r')) {
      if (this.peek() === '\n') this.line++;
      this.i++;
    }
  }

  private skipComment(): void {
    if (this.peek() === '#') {
      while (!this.eof() && this.peek() !== '\n') this.i++;
    }
  }

  private skipWsComments(): void {
    for (;;) {
      this.skipWs();
      if (this.peek() === '#') { this.skipComment(); continue; }
      if (this.peek() === '\n' || this.peek() === '\r') { this.skipNewlines(); continue; }
      break;
    }
  }

  private expect(ch: string): void {
    if (this.peek() !== ch) this.err(`Expected "${ch}" but found "${this.peek() || 'end of input'}"`);
    this.i++;
  }

  private parseBasicString(): string {
    const quote = this.peek();
    const multiline = this.peek(1) === quote && this.peek(2) === quote;
    if (multiline) {
      this.i += 3;
      if (this.peek() === '\r') { this.i++; if (this.peek() === '\n') { this.i++; this.line++; } }
      else if (this.peek() === '\n') { this.i++; this.line++; }
      let out = '';
      for (;;) {
        if (this.eof()) this.err('Unterminated multi-line string');
        if (this.peek() === quote && this.peek(1) === quote && this.peek(2) === quote) { this.i += 3; return out; }
        const ch = this.peek();
        if (ch === '\\' && quote === '"') { out += this.readEscape(true); continue; }
        if (ch === '\n') this.line++;
        out += ch;
        this.i++;
      }
    }
    this.i++;
    let out = '';
    for (;;) {
      if (this.eof()) this.err('Unterminated string');
      const ch = this.peek();
      if (ch === quote) { this.i++; return out; }
      if (ch === '\n') this.err('Newline in a single-line string');
      if (ch === '\\' && quote === '"') { out += this.readEscape(false); continue; }
      out += ch;
      this.i++;
    }
  }

  private readEscape(multiline: boolean): string {
    this.i++;
    const ch = this.peek();
    const simple: Record<string, string> = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };
    if (ch in simple) { this.i++; return simple[ch]!; }
    if (multiline && (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t')) {
      while (!this.eof() && (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\n' || this.peek() === '\r')) {
        if (this.peek() === '\n') this.line++;
        this.i++;
      }
      return '';
    }
    if (ch === 'u' || ch === 'U') {
      const len = ch === 'u' ? 4 : 8;
      const hex = this.src.slice(this.i + 1, this.i + 1 + len);
      if (hex.length !== len || !/^[0-9A-Fa-f]+$/.test(hex)) this.err('Invalid unicode escape');
      this.i += 1 + len;
      return String.fromCodePoint(parseInt(hex, 16));
    }
    this.err(`Invalid escape "\\${ch}"`);
  }

  private parseKeySegment(): string {
    this.skipWs();
    const ch = this.peek();
    if (ch === '"' || ch === "'") return this.parseBasicString();
    let out = '';
    while (!this.eof() && /[A-Za-z0-9_-]/.test(this.peek())) { out += this.peek(); this.i++; }
    if (!out) this.err('Expected a key');
    return out;
  }

  private parseKeyPath(): string[] {
    const path: string[] = [];
    for (;;) {
      path.push(this.parseKeySegment());
      this.skipWs();
      if (this.peek() === '.') { this.i++; continue; }
      return path;
    }
  }

  private parseScalar(): Json {
    const start = this.i;
    while (!this.eof() && !/[\s,\]}#]/.test(this.peek())) this.i++;
    const raw = this.src.slice(start, this.i);
    if (!raw) this.err('Expected a value');
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    const bare = raw.replace(/_/g, '');
    if (DATE_RE.test(bare) || TIME_RE.test(bare)) return raw;
    if (HEX_RE.test(bare)) return parseInt(bare.replace(/^[+-]?0x/, ''), 16) * (bare.startsWith('-') ? -1 : 1);
    if (OCT_RE.test(bare)) return parseInt(bare.replace(/^[+-]?0o/, ''), 8) * (bare.startsWith('-') ? -1 : 1);
    if (BIN_RE.test(bare)) return parseInt(bare.replace(/^[+-]?0b/, ''), 2) * (bare.startsWith('-') ? -1 : 1);
    if (INT_RE.test(bare)) return parseInt(bare, 10);
    if (FLOAT_RE.test(bare) && /[.eE]/.test(bare)) return parseFloat(bare);
    if (/^[+-]?inf$/.test(bare)) return bare.startsWith('-') ? -Infinity : Infinity;
    if (/^[+-]?nan$/.test(bare)) return NaN;
    this.err(`Cannot parse value "${raw}" — strings must be quoted`);
  }

  private parseArray(): Json[] {
    this.expect('[');
    const out: Json[] = [];
    for (;;) {
      this.skipWsComments();
      if (this.peek() === ']') { this.i++; return out; }
      out.push(this.parseValue());
      this.skipWsComments();
      if (this.peek() === ',') { this.i++; continue; }
      if (this.peek() === ']') { this.i++; return out; }
      this.err('Expected "," or "]" in array');
    }
  }

  private parseInlineTable(): Obj {
    this.expect('{');
    const out: Obj = {};
    this.skipWs();
    if (this.peek() === '}') { this.i++; return out; }
    for (;;) {
      const path = this.parseKeyPath();
      this.skipWs();
      this.expect('=');
      const value = this.parseValue();
      TomlParser.assign(out, path, value, (m) => this.err(m));
      this.skipWs();
      if (this.peek() === ',') { this.i++; this.skipWs(); if (this.peek() === '}') { this.i++; return out; } continue; }
      if (this.peek() === '}') { this.i++; return out; }
      this.err('Expected "," or "}" in inline table');
    }
  }

  private parseValue(): Json {
    this.skipWs();
    const ch = this.peek();
    if (ch === '"' || ch === "'") return this.parseBasicString();
    if (ch === '[') return this.parseArray();
    if (ch === '{') return this.parseInlineTable();
    return this.parseScalar();
  }

  private static assign(target: Obj, path: string[], value: Json, fail: (m: string) => never): void {
    let node = target;
    for (let idx = 0; idx < path.length - 1; idx++) {
      const key = path[idx]!;
      let next = node[key];
      if (next === undefined) { next = {}; node[key] = next; }
      if (!isPlainObject(next)) fail(`Key "${key}" is already a value and cannot hold a table`);
      node = next;
    }
    const last = path[path.length - 1]!;
    if (node[last] !== undefined) fail(`Key "${last}" is defined more than once`);
    node[last] = value;
  }

  private descend(path: string[], arrayOfTables: boolean): Obj {
    let node = this.root;
    for (let idx = 0; idx < path.length; idx++) {
      const key = path[idx]!;
      const last = idx === path.length - 1;
      if (last && arrayOfTables) {
        let arr = node[key];
        if (arr === undefined) { arr = []; node[key] = arr; }
        if (!Array.isArray(arr)) this.err(`"${key}" is not an array of tables`);
        const fresh: Obj = {};
        arr.push(fresh);
        return fresh;
      }
      let next = node[key];
      if (next === undefined) { next = {}; node[key] = next; }
      if (Array.isArray(next)) {
        const tail = next[next.length - 1];
        if (tail === undefined || !isPlainObject(tail)) this.err(`"${key}" is not a table`);
        node = tail;
        continue;
      }
      if (!isPlainObject(next)) this.err(`"${key}" is not a table`);
      node = next;
    }
    return node;
  }

  parse(): Obj {
    for (;;) {
      this.skipWsComments();
      if (this.eof()) return this.root;
      if (this.peek() === '[') {
        const isArray = this.peek(1) === '[';
        this.i += isArray ? 2 : 1;
        const path = this.parseKeyPath();
        this.skipWs();
        this.expect(']');
        if (isArray) this.expect(']');
        this.current = this.descend(path, isArray);
        this.skipWs();
        this.skipComment();
        continue;
      }
      const path = this.parseKeyPath();
      this.skipWs();
      this.expect('=');
      const value = this.parseValue();
      TomlParser.assign(this.current, path, value, (m) => this.err(m));
      this.skipWs();
      this.skipComment();
      if (!this.eof() && this.peek() !== '\n' && this.peek() !== '\r') this.err(`Unexpected "${this.peek()}" after value`);
      this.skipNewlines();
    }
  }
}

function tomlKey(key: string): string {
  return BARE_KEY_RE.test(key) ? key : JSON.stringify(key);
}

function tomlValue(value: Json, skipped: { count: number }): string {
  if (value === null) { skipped.count++; return '""'; }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'nan';
    if (value === Infinity) return 'inf';
    if (value === -Infinity) return '-inf';
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => tomlValue(v, skipped)).join(', ')}]`;
  const entries = Object.entries(value).filter(([, v]) => v !== null);
  skipped.count += Object.values(value).filter((v) => v === null).length;
  return `{ ${entries.map(([k, v]) => `${tomlKey(k)} = ${tomlValue(v, skipped)}`).join(', ')} }`;
}

function serialize(obj: Obj, prefix: string[], out: string[], skipped: { count: number }): void {
  const scalars: [string, Json][] = [];
  const tables: [string, Obj][] = [];
  const arrayTables: [string, Obj[]][] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) { skipped.count++; continue; }
    if (Array.isArray(value)) {
      if (value.length > 0 && value.every((item) => isPlainObject(item))) {
        arrayTables.push([key, value as Obj[]]);
      } else {
        scalars.push([key, value]);
      }
      continue;
    }
    if (isPlainObject(value)) tables.push([key, value]);
    else scalars.push([key, value]);
  }
  for (const [key, value] of scalars) out.push(`${tomlKey(key)} = ${tomlValue(value, skipped)}`);
  for (const [key, value] of tables) {
    const path = [...prefix, key];
    if (out.length) out.push('');
    out.push(`[${path.map(tomlKey).join('.')}]`);
    serialize(value, path, out, skipped);
  }
  for (const [key, items] of arrayTables) {
    const path = [...prefix, key];
    for (const item of items) {
      if (out.length) out.push('');
      out.push(`[[${path.map(tomlKey).join('.')}]]`);
      serialize(item, path, out, skipped);
    }
  }
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const source = input.text.trim();
  if (!source) {
    return {
      output: JSON.stringify({ headers: ['Mode', 'Input', 'Result'], rows: [] as string[][] }),
      render: 'table',
      notes: ['Paste TOML to convert it to JSON, or switch to JSON → TOML mode and paste an object.'],
    };
  }
  if (mode === 'to-toml') {
    let parsed: Json;
    try {
      parsed = JSON.parse(source) as Json;
    } catch {
      throw new ToolError('Invalid JSON — check for trailing commas, comments, or unquoted keys.');
    }
    if (!isPlainObject(parsed)) throw new ToolError('TOML cannot represent a bare JSON scalar or array at the top level; wrap it in an object.');
    const skipped = { count: 0 };
    const lines: string[] = [];
    serialize(parsed, [], lines, skipped);
    const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    return {
      output: text,
      render: 'code',
      language: 'text',
      filename: 'converted.toml',
      stats: { topLevelKeys: Object.keys(parsed).length, omittedNulls: skipped.count },
      notes: skipped.count ? [`${skipped.count} null value(s) omitted — TOML has no null type.`] : ['Serialized JSON to TOML with tables and arrays of tables where possible.'],
    };
  }
  const data = new TomlParser(source).parse();
  return {
    output: JSON.stringify(data, null, 2),
    render: 'code',
    language: 'json',
    filename: 'converted.json',
    stats: { topLevelKeys: Object.keys(data).length, lines: source.split('\n').length },
    notes: ['Parsed TOML to JSON. Date-time values stay as strings; numbers are emitted as JSON numbers.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
