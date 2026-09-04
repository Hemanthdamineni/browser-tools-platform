import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './dotenv.meta';

function unescapeDouble(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '\\' && i + 1 < s.length) {
      const n = s[i + 1]!;
      if (n === 'n') {
        out += '\n';
        i++;
        continue;
      }
      if (n === 't') {
        out += '\t';
        i++;
        continue;
      }
      if (n === 'r') {
        out += '\r';
        i++;
        continue;
      }
      if (n === '"') {
        out += '"';
        i++;
        continue;
      }
      if (n === '\\') {
        out += '\\';
        i++;
        continue;
      }
    }
    out += c;
  }
  return out;
}

function expandValue(val: string, vars: Record<string, string>): string {
  return val.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : '',
  );
}

function parseEnv(text: string, expand: boolean): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trim();

    const eq = line.indexOf('=');
    if (eq === -1) {
      throw new ToolError(
        `Line is not KEY=VALUE: "${rawLine.trim()}"`,
        'Comment lines must start with # and every other line needs an = sign.',
      );
    }
    const key = line.slice(0, eq).trim();
    if (!key) throw new ToolError(`Missing key in line: "${rawLine.trim()}"`);

    let value = line.slice(eq + 1).trim();
    let quote = '';
    if (
      value.length >= 2 &&
      (value[0] === '"' || value[0] === "'") &&
      value[value.length - 1] === value[0]
    ) {
      quote = value[0]!;
      value = value.slice(1, -1);
      if (quote === '"') value = unescapeDouble(value);
    } else {
      const hash = value.search(/\s#/);
      if (hash !== -1) value = value.slice(0, hash).trimEnd();
    }

    if (expand && quote !== "'") value = expandValue(value, result);
    result[key] = value;
  }
  return result;
}

function scalarStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function buildEnv(obj: Record<string, unknown>, quoteValues: boolean): string {
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(obj)) {
    const value = scalarStr(raw);
    let rendered = value;
    if (quoteValues && /[\s#"'\\]/.test(value)) {
      rendered = `"${value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')}"`;
    }
    lines.push(`${key}=${rendered}`);
  }
  return lines.join('\n');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  if (o.mode === 'build') {
    let data: unknown;
    try {
      data = JSON.parse(input.text);
    } catch (e) {
      throw new ToolError('Invalid JSON input.', (e as Error).message);
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new ToolError(
        'Expected a JSON object.',
        'The top level must be an object of key/value pairs.',
      );
    }
    const output = buildEnv(data as Record<string, unknown>, Boolean(o.quoteValues));
    return {
      output,
      render: 'code',
      language: 'bash',
      filename: '.env',
      stats: { keys: Object.keys(data as Record<string, unknown>).length },
    };
  }

  const parsed = parseEnv(input.text, Boolean(o.expand));
  const output = JSON.stringify(parsed, null, 2);
  return {
    output,
    render: 'code',
    language: 'json',
    filename: 'env.json',
    stats: { keys: Object.keys(parsed).length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
