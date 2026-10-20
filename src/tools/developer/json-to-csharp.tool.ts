import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-csharp.meta';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const ACRONYMS = new Set([
  'id', 'url', 'uri', 'api', 'ip', 'ui', 'json', 'xml', 'html', 'css', 'sql', 'http', 'https', 'ftp', 'ssh', 'tls',
]);
const KEYWORDS = new Set([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked', 'class', 'const',
  'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern',
  'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface',
  'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override',
  'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
  'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
  'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
]);

function pascalName(key: string, used: Set<string>): string {
  const words = key.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  let name = '';
  for (const w of words) {
    const lower = w.toLowerCase();
    if (ACRONYMS.has(lower)) {
      name += lower.toUpperCase();
    } else if (w.length === 0) {
      name += '';
    } else {
      name += w[0]!.toUpperCase() + w.slice(1);
    }
  }
  if (!name) name = 'Value';
  if (!/^[A-Za-z_]/.test(name)) name = 'V_' + name;
  if (KEYWORDS.has(name.toLowerCase())) name = '@' + name;
  const dedupe = name;
  let i = 2;
  while (used.has(name)) {
    name = dedupe + i;
    i++;
  }
  used.add(name);
  return name;
}

interface Def {
  name: string;
  fields: string[];
}

class Generator {
  defs: Def[] = [];
  emitted = new Set<string>();
  usedNames = new Set<string>();
  includeAttributes: boolean;

  constructor(includeAttributes: boolean) {
    this.includeAttributes = includeAttributes;
  }

  declare(name: string, obj: { [key: string]: Json }): void {
    if (this.emitted.has(name)) return;
    this.emitted.add(name);
    const fields: string[] = [];
    for (const key of Object.keys(obj)) {
      const propertyName = pascalName(key, this.usedNames);
      const value = obj[key] as Json;
      const valueType = this.typeOf(value, `${name}${propertyName}`);
      for (const attr of this.attributes(key)) fields.push(attr);
      fields.push(`    public ${valueType} ${propertyName} { get; set; } = default!;`);
      fields.push('');
    }
    this.defs.push({ name, fields });
  }

  private attributes(key: string): string[] {
    if (!this.includeAttributes) return [];
    return [`    [JsonPropertyName("${key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")]`];
  }

  typeOf(value: Json, suggested: string): string {
    if (value === null) return 'object?';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List<object>';
      const nonNull = value.filter((v) => v !== null);
      const first = nonNull[0];
      if (first !== undefined && typeof first === 'object' && !Array.isArray(first)) {
        const elem = suggested;
        if (Object.keys(first).length > 0) this.declare(elem, first);
        return `List<${elem}>`;
      }
      const kinds = new Set(nonNull.map((v) => typeof v));
      if (kinds.size === 1) {
        const only = [...kinds][0]!;
        if (only === 'string') return 'List<string>';
        if (only === 'boolean') return 'List<bool>';
        if (only === 'number') return 'List<int>';
      }
      return 'List<object>';
    }
    const keys = Object.keys(value);
    if (keys.length === 0) return 'object';
    if (!this.emitted.has(suggested)) this.declare(suggested, value);
    return suggested;
  }

  render(): string {
    return this.defs.map((d) => `public class ${d.name}\n{\n${d.fields.join('\n')}}`).join('\n\n');
  }
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const rootName = String(o.rootName ?? 'Root').trim() || 'Root';
  const includeAttributes = Boolean(o.attributes);

  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError('Paste a JSON object or array.', 'A single JSON value; its shape becomes the C# types.');
  }

  let parsed: Json;
  try {
    parsed = JSON.parse(text) as Json;
  } catch (e) {
    throw new ToolError(`Invalid JSON: ${(e as Error).message}`, 'Check quotes, commas and brackets.');
  }

  const gen = new Generator(includeAttributes);
  const arrayRoot = Array.isArray(parsed);
  const rootObj = arrayRoot ? ((parsed as Json[]).find((v) => v !== null && typeof v === 'object' && !Array.isArray(v)) as { [key: string]: Json }) : (parsed as { [key: string]: Json });

  if (arrayRoot && (parsed as Json[]).length === 0) {
    throw new ToolError('The JSON array is empty.', 'An empty array has no element type to infer.');
  }
  if (!arrayRoot && (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))) {
    throw new ToolError('The root must be an object or array of objects.', 'Paste a JSON object like {"name":"Ada"} or an array of objects.');
  }
  if (!rootObj) {
    throw new ToolError('The JSON array has no object element.', 'Null and primitive elements cannot be typed.');
  }

  gen.usedNames.add(rootName);
  gen.declare(rootName, rootObj);

  const header = includeAttributes
    ? ['using System.Collections.Generic;', 'using System.Text.Json.Serialization;', '']
    : ['using System.Collections.Generic;', ''];
  const usage = arrayRoot
    ? `var items = JsonSerializer.Deserialize<List<${rootName}>>(json);`
    : `var item = JsonSerializer.Deserialize<${rootName}>(json);`;
  const output = `${header.join('\n')}${gen.render()}\n\n// usage:\n// ${usage}\n`;

  let types = 1;
  let properties = 0;
  for (const d of gen.defs) {
    properties += d.fields.filter((f) => f.startsWith('    public ') && !f.startsWith('    public class ')).length;
  }
  types = gen.defs.length;

  return {
    output,
    render: 'code',
    stats: { types, properties },
    notes: [
      'Generated C# classes with System.Text.Json. Deserialization works without attributes; they only enforce exact key naming.',
      arrayRoot ? 'Root is an array: deserialize into a List.' : 'Usage comment shows JsonSerializer.Deserialize.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
