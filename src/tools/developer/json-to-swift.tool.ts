import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-swift.meta';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const ACRONYMS = new Set([
  'id',
  'url',
  'uri',
  'api',
  'ip',
  'json',
  'xml',
  'html',
  'css',
  'sql',
  'http',
  'https',
  'ftp',
]);
const KEYWORDS = new Set([
  'class',
  'struct',
  'enum',
  'protocol',
  'extension',
  'func',
  'let',
  'var',
  'true',
  'false',
  'nil',
  'self',
  'Type',
  'String',
  'Int',
  'Double',
  'Float',
  'Bool',
  'Any',
  'Array',
  'Dictionary',
  'Set',
  'case',
  'default',
  'if',
  'else',
  'for',
  'while',
  'repeat',
  'do',
  'switch',
  'guard',
  'return',
  'throw',
  'throws',
  'init',
  'deinit',
  'static',
  'final',
  'override',
  'import',
  'public',
  'private',
  'internal',
  'fileprivate',
  'open',
  'associatedtype',
  'where',
  'as',
  'is',
  'in',
  'await',
  'async',
  'subscript',
]);

function wordsOf(key: string): string[] {
  return key.split(/[^a-zA-Z0-9]+/).filter(Boolean);
}

function pascalName(key: string, used: Set<string>): string {
  const words = wordsOf(key);
  let name = '';
  for (const w of words) {
    const lower = w.toLowerCase();
    if (ACRONYMS.has(lower)) name += lower.toUpperCase();
    else if (w) name += w[0]!.toUpperCase() + w.slice(1);
  }
  if (!name) name = 'Value';
  if (!/^[A-Za-z]/.test(name)) name = 'X' + name;
  const dedupe = name;
  let i = 2;
  while (used.has(name)) {
    name = dedupe + i;
    i++;
  }
  used.add(name);
  return name;
}

function swiftName(key: string, used: Set<string>): string {
  const words = wordsOf(key);
  let name = '';
  words.forEach((w, i) => {
    const lower = w.toLowerCase();
    if (i === 0) {
      name += lower;
    } else if (ACRONYMS.has(lower)) {
      name += lower.toUpperCase();
    } else {
      name += w[0]!.toUpperCase() + w.slice(1);
    }
  });
  if (!name) name = 'value';
  if (!/^[A-Za-z]/.test(name)) name = 'x' + name;
  if (KEYWORDS.has(name)) name = `\`${name}\``;
  const dedupe = name;
  let i = 2;
  while (used.has(name)) {
    name = `${dedupe}${i}`;
    i++;
  }
  used.add(name);
  return name;
}

interface Def {
  name: string;
  lines: string[];
  keyMappings: string[];
}

class Generator {
  defs: Def[] = [];
  emitted = new Set<string>();
  usedTypeNames = new Set<string>();
  usedPropNames = new Set<string>();
  emitCodingKeys: boolean;
  mutable: boolean;

  constructor(emitCodingKeys: boolean, mutable: boolean) {
    this.emitCodingKeys = emitCodingKeys;
    this.mutable = mutable;
  }

  declare(name: string, obj: { [key: string]: Json }): void {
    if (this.emitted.has(name)) return;
    this.emitted.add(name);
    const lines: string[] = [];
    const keyMappings: string[] = [];
    for (const rawKey of Object.keys(obj)) {
      const pascal = pascalName(rawKey, this.usedTypeNames);
      const prop = swiftName(rawKey, this.usedPropNames);
      const valueType = this.typeOf(obj[rawKey] as Json, name, pascal);
      lines.push(`    ${this.mutable ? 'var' : 'let'} ${prop}: ${valueType}`);
      if (this.emitCodingKeys) {
        const display = prop.replace(/`/g, '');
        if (rawKey !== display) keyMappings.push(`        case ${display} = "${rawKey}"`);
      }
    }
    this.defs.push({ name, lines, keyMappings: keyMappings });
  }

  typeOf(value: Json, parent: string, pascal: string): string {
    if (value === null) return 'String?';
    if (typeof value === 'string') return 'String';
    if (typeof value === 'boolean') return 'Bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'Int' : 'Double';
    if (Array.isArray(value)) {
      if (value.length === 0) return '[String]';
      const first = value.find((v) => v !== null && typeof v === 'object' && !Array.isArray(v));
      if (first) {
        const nested = `${parent}${pascal}`;
        this.declare(nested, first as { [key: string]: Json });
        return `[${nested}]`;
      }
      const nonNull = value.filter((v) => v !== null);
      const kinds = new Set(nonNull.map((v) => typeof v));
      if (kinds.size === 1) {
        const only = [...kinds][0]!;
        if (only === 'string') return '[String]';
        if (only === 'boolean') return '[Bool]';
        if (only === 'number') return Number.isInteger(nonNull[0]) ? '[Int]' : '[Double]';
      }
      return '[String]';
    }
    if (typeof value === 'object') {
      const nested = `${parent}${pascal}`;
      this.declare(nested, value);
      return nested;
    }
    return 'String?';
  }

  render(): string {
    return this.defs
      .map((d) => {
        const head = `struct ${d.name}: Codable {`;
        const body = d.lines.length > 0 ? d.lines.join('\n') : '    // empty object';
        const keyPart =
          d.keyMappings.length > 0
            ? `\n\n    enum CodingKeys: String, CodingKey {\n${d.keyMappings.join('\n')}\n    }`
            : '';
        return `${head}\n${body}${keyPart}\n}`;
      })
      .join('\n\n');
  }
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const rootName = String(o.rootName ?? 'Root').trim() || 'Root';
  const emitCodingKeys = Boolean(o.codingKeys);
  const mutable = String(o.propertyStyle) === 'var';

  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError(
      'Paste a JSON object or array.',
      'A single JSON value; its shape becomes the Swift structs.',
    );
  }
  let parsed: Json;
  try {
    parsed = JSON.parse(text) as Json;
  } catch (e) {
    throw new ToolError(
      `Invalid JSON: ${(e as Error).message}`,
      'Check quotes, commas and brackets.',
    );
  }

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    (Array.isArray(parsed) && parsed.length === 0)
  ) {
    throw new ToolError(
      'The root must be a non-empty JSON object or array.',
      'An empty array cannot be typed.',
    );
  }

  const arrayRoot = Array.isArray(parsed);
  const rootObj = arrayRoot
    ? (parsed as Json[]).find((v) => v !== null && typeof v === 'object' && !Array.isArray(v))
    : parsed;
  if (!rootObj) {
    throw new ToolError(
      'The JSON array holds no object element.',
      'Null and primitive elements cannot be typed.',
    );
  }

  const gen = new Generator(emitCodingKeys, mutable);
  gen.usedTypeNames.add(rootName);
  gen.declare(rootName, rootObj as { [key: string]: Json });

  const output = `import Foundation\n\n${gen.render()}\n\n// usage:\n// let data = json.data(using: .utf8)!\n// ${arrayRoot ? `let items = try? JSONDecoder().decode([${rootName}].self, from: data)` : `let item = try? JSONDecoder().decode(${rootName}.self, from: data)`}\n`;

  let fields = 0;
  for (const d of gen.defs) fields += d.lines.length;

  return {
    output,
    render: 'code',
    stats: { structs: gen.defs.length, fields },
    notes: [
      'Swift Codable structs generated on-device. Null/empty/mixed values use String? and [String] fallbacks.',
      'Add keyDecodingStrategy .convertFromSnakeCase at the decoder when CodingKeys is off.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
