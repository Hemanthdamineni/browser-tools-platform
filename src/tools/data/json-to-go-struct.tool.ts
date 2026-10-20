import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-go-struct.meta';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const ACRONYMS = new Set(['id', 'url', 'api', 'json', 'http', 'html', 'ip', 'uuid', 'sql', 'xml', 'db', 'ui', 'css', 'js', 'aws', 'os', 'tls', 'ssl', 'sha', 'hex']);
const KEYWORDS = new Set(['type', 'func', 'map', 'range', 'go', 'defer', 'select', 'var', 'const', 'package', 'return']);

function wordCap(word: string): string {
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function goName(key: string, used: Set<string>): string {
  const words = key.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 0);
  let base = words.map(wordCap).join('') || `Field${used.size + 1}`;
  if (/^[0-9]/.test(base)) base = `Field${base}`;
  if (KEYWORDS.has(base.toLowerCase())) base += '_';
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base}${i++}`;
  used.add(name);
  return name;
}

interface Def {
  name: string;
  obj: { [key: string]: Json };
}

class Generator {
  defs: Def[] = [];
  emitted = new Set<string>();
  usedNames = new Set<string>();
  fieldsByType = new Map<string, string[]>();
  omitempty: boolean;
  includeTags: boolean;

  constructor(omitempty: boolean, includeTags: boolean) {
    this.omitempty = omitempty;
    this.includeTags = includeTags;
  }

  private declare(name: string, obj: { [key: string]: Json }): void {
    if (this.emitted.has(name)) return;
    this.emitted.add(name);
    const fields: string[] = [];
    for (const key of Object.keys(obj)) {
      const fieldName = goName(key, this.usedNames);
      const value = obj[key] as Json;
      const valueType = this.typeOf(value, `${name}${fieldName}`);
      const tag = this.includeTags ? ` \`json:"${key}${this.omitempty ? ',omitempty' : ''}"\`` : '';
      fields.push(`\t${fieldName} ${valueType}${tag}`);
    }
    this.defs.push({ name, obj });
    this.fieldsByType.set(name, fields);
  }

  typeOf(value: Json, suggested: string): string {
    if (value === null) return 'interface{}';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float64';
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]interface{}';
      const nonNull = value.filter((v) => v !== null);
      const first = nonNull[0];
      if (first !== undefined && typeof first === 'object' && !Array.isArray(first)) {
        const elem = suggested;
        this.declare(elem, first);
        return `[]${elem}`;
      }
      const kinds = new Set(nonNull.map((v) => typeof v));
      if (kinds.size === 1) {
        const only = [...kinds][0]!;
        if (only === 'string') return '[]string';
        if (only === 'boolean') return '[]bool';
        if (only === 'number') {
          const allInt = nonNull.every((v) => typeof v === 'number' && Number.isInteger(v));
          return allInt ? '[]int' : '[]float64';
        }
      }
      return '[]interface{}';
    }
    this.declare(suggested, value);
    return suggested;
  }

  render(): string {
    const out: string[] = [];
    for (const def of this.defs) {
      out.push(`type ${def.name} struct {`);
      const fields = this.fieldsByType.get(def.name) ?? [];
      if (fields.length === 0) out.push('\t// Empty object');
      for (const f of fields) out.push(f);
      out.push('}');
      out.push('');
    }
    return out.join('\n');
  }
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const rootName = String(o.rootName ?? 'MyStruct').trim() || 'MyStruct';
  const omitempty = o.omitempty !== false;
  const includeTags = String(o.tags) !== 'none';

  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError('Paste a JSON object or array.', 'A single JSON value with strings, numbers, booleans, arrays and objects.');
  }

  let parsed: Json;
  try {
    parsed = JSON.parse(text) as Json;
  } catch (e) {
    throw new ToolError(`Invalid JSON: ${(e as Error).message}`, 'Check for missing quotes, commas or brackets.');
  }

  const gen = new Generator(omitempty, includeTags);
  const base = goName(rootName, gen.usedNames);

  let top = base;
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new ToolError('The JSON array is empty.', 'Provide at least one element so a slice element type can be inferred.');
    }
    top = gen.typeOf(parsed, base);
  } else {
    gen.typeOf(parsed, base);
  }

  let output = gen.render();
  const usage = Array.isArray(parsed) ? top : base;
  output = `// var data ${usage}; json.Unmarshal(raw, &data)\n${output.trimEnd()}\n`;

  const typeCount = gen.defs.length;
  const fieldCount = gen.defs.reduce((n, d) => n + (gen.fieldsByType.get(d.name)?.length ?? 0), 0);

  return {
    output,
    render: 'code',
    stats: { types: typeCount, fields: fieldCount },
    notes: [
      `Generated ${typeCount} named type${typeCount === 1 ? '' : 's'} with ${fieldCount} fields.`,
      'Whole numbers become int; fractional numbers float64. Null and mixed arrays become interface{}.',
    ],
  };
}

const tool: TextToolModule = { meta, run: run };
export default tool;
