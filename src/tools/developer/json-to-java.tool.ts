import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-java.meta';

const MAX_LEN = 2_000_000;
const RESERVED = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
  'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
  'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null', 'var', 'record',
]);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fieldName(key: string): string {
  const parts = key.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  let name = parts.map((p, i) => (i === 0 ? p.toLowerCase() : capitalize(p.toLowerCase()))).join('');
  if (name === '') name = 'field';
  if (/^[0-9]/.test(name)) name = '_' + name;
  if (RESERVED.has(name)) name = name + '_';
  return name;
}

function className(raw: string): string {
  const parts = raw.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const name = parts.map((p) => capitalize(p)).join('');
  if (name === '') return 'Model';
  return /^[A-Za-z_$]/.test(name) ? name : 'Model' + name;
}

type JType =
  | { kind: 'String' }
  | { kind: 'Integer' }
  | { kind: 'Long' }
  | { kind: 'Double' }
  | { kind: 'Boolean' }
  | { kind: 'Object' }
  | { kind: 'List'; item: JType }
  | { kind: 'Class'; name: string };

interface Field {
  name: string;
  type: JType;
}

interface ClassDef {
  name: string;
  fields: Field[];
}

function mergeType(a: JType, b: JType): JType {
  if (a.kind === b.kind) {
    if (a.kind === 'List' && b.kind === 'List') return { kind: 'List', item: mergeType(a.item, b.item) };
    return a;
  }
  const nums = new Set(['Integer', 'Long', 'Double']);
  if (nums.has(a.kind) && nums.has(b.kind)) {
    if (a.kind === 'Double' || b.kind === 'Double') return { kind: 'Double' };
    return { kind: 'Long' };
  }
  return { kind: 'Object' };
}

function uniqueName(base: string, classes: ClassDef[]): string {
  const taken = new Set(classes.map((c) => c.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(base + i)) i += 1;
  return base + i;
}

function infer(value: unknown, nameHint: string, classes: ClassDef[]): JType {
  if (value === null || value === undefined) return { kind: 'Object' };
  if (typeof value === 'string') return { kind: 'String' };
  if (typeof value === 'boolean') return { kind: 'Boolean' };
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return { kind: 'Double' };
    if (value > 2147483647 || value < -2147483648) return { kind: 'Long' };
    return { kind: 'Integer' };
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'List', item: { kind: 'Object' } };
    let item: JType | null = null;
    for (const el of value) {
      const t = infer(el, nameHint, classes);
      item = item === null ? t : mergeType(item, t);
    }
    return { kind: 'List', item: item ?? { kind: 'Object' } };
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const def: ClassDef = { name: uniqueName(className(nameHint), classes), fields: [] };
    classes.push(def);
    const seen = new Set<string>();
    for (const key of Object.keys(obj)) {
      const fname = fieldName(key);
      if (seen.has(fname)) continue;
      seen.add(fname);
      def.fields.push({ name: fname, type: infer(obj[key], capitalize(key), classes) });
    }
    if (def.fields.length === 0) def.fields.push({ name: 'value', type: { kind: 'Object' } });
    return { kind: 'Class', name: def.name };
  }
  return { kind: 'Object' };
}

function renderType(t: JType, boxed: boolean): string {
  switch (t.kind) {
    case 'String':
      return 'String';
    case 'Boolean':
      return boxed ? 'Boolean' : 'boolean';
    case 'Integer':
      return boxed ? 'Integer' : 'int';
    case 'Long':
      return boxed ? 'Long' : 'long';
    case 'Double':
      return boxed ? 'Double' : 'double';
    case 'Object':
      return 'Object';
    case 'List':
      return 'List<' + renderType(t.item, true) + '>';
    case 'Class':
      return t.name;
  }
}

/** Field declarations + accessors for POJO/Lombok bodies (no class wrapper). */
function renderBody(def: ClassDef, style: string, boxed: boolean, indent: string): string[] {
  const out: string[] = [];
  const pad = indent + '    ';
  for (const f of def.fields) out.push(pad + 'private ' + renderType(f.type, boxed) + ' ' + f.name + ';');
  if (style === 'pojo') {
    for (const f of def.fields) {
      const type = renderType(f.type, boxed);
      const cap = capitalize(f.name);
      out.push('');
      out.push(pad + 'public ' + type + ' get' + cap + '() {');
      out.push(pad + '    return ' + f.name + ';');
      out.push(pad + '}');
      out.push('');
      out.push(pad + 'public void set' + cap + '(' + type + ' ' + f.name + ') {');
      out.push(pad + '    this.' + f.name + ' = ' + f.name + ';');
      out.push(pad + '}');
    }
  }
  return out;
}

function recordComponents(def: ClassDef, boxed: boolean): string {
  return def.fields.map((f) => renderType(f.type, boxed) + ' ' + f.name).join(', ');
}

/** A nested type declaration (static class, or nested record). */
function renderNested(def: ClassDef, style: string, boxed: boolean, indent: string): string[] {
  const out: string[] = [];
  if (style === 'record') {
    out.push(indent + 'public record ' + def.name + '(' + recordComponents(def, boxed) + ') {}');
    return out;
  }
  if (style === 'lombok') out.push(indent + '@Data');
  out.push(indent + 'public static class ' + def.name + ' {');
  out.push(...renderBody(def, style, boxed, indent));
  out.push(indent + '}');
  return out;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const rootName = className(String(o.className ?? 'Model'));
  const packageName = String(o.packageName ?? '').trim();
  const style = String(o.style ?? 'pojo');
  const boxed = o.useWrapperTypes !== false;

  const raw = String(input.text ?? '').trim();
  if (!raw) throw new ToolError('Paste JSON to convert to Java classes.');
  if (raw.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ToolError('Invalid JSON: ' + (e as Error).message);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new ToolError('Top level must be a JSON object or an array of objects.');
  }

  const sample = Array.isArray(parsed) ? parsed[0] : parsed;
  if (sample === undefined) throw new ToolError('The JSON array is empty.');
  if (sample === null || typeof sample !== 'object' || Array.isArray(sample)) {
    throw new ToolError('Top level must be a JSON object or an array of objects.');
  }

  // Root fields are inferred against a shared class registry so nested types resolve.
  const classes: ClassDef[] = [];
  const rootDef: ClassDef = { name: rootName, fields: [] };
  classes.push(rootDef);
  const seen = new Set<string>();
  for (const key of Object.keys(sample as Record<string, unknown>)) {
    const fname = fieldName(key);
    if (seen.has(fname)) continue;
    seen.add(fname);
    rootDef.fields.push({ name: fname, type: infer((sample as Record<string, unknown>)[key], capitalize(key), classes) });
  }
  if (rootDef.fields.length === 0) throw new ToolError('The object has no fields to convert.');

  const nested = classes.filter((c) => c !== rootDef);
  const lines: string[] = [];
  if (packageName) {
    lines.push('package ' + packageName + ';');
    lines.push('');
  }
  if (style === 'lombok') {
    lines.push('import lombok.Data;');
    lines.push('');
  }
  lines.push('import java.util.List;');
  lines.push('');

  if (style === 'record') {
    lines.push('public record ' + rootName + '(' + recordComponents(rootDef, boxed) + ') {');
    if (nested.length > 0) {
      for (const def of nested) {
        lines.push(...renderNested(def, style, boxed, '    '));
        lines.push('');
      }
      lines.pop();
    }
    lines.push('}');
  } else {
    if (style === 'lombok') lines.push('@Data');
    lines.push('public class ' + rootName + ' {');
    lines.push(...renderBody(rootDef, style, boxed, '    '));
    for (const def of nested) {
      lines.push('');
      lines.push(...renderNested(def, style, boxed, '    '));
    }
    lines.push('}');
  }

  return {
    output: lines.join('\n') + '\n',
    render: 'text',
    language: 'java',
    stats: { classes: classes.length, fields: classes.reduce((n, c) => n + c.fields.length, 0) },
    notes: [
      classes.length + ' class(es), style: ' + style + '.',
      boxed ? 'Wrapper types used — null values map cleanly.' : 'Primitives used — beware of null JSON values.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
