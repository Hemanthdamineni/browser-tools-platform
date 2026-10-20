import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-patch.meta';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type PatchOperation =
  | { op: 'add' | 'replace' | 'test'; path: string; value: Json }
  | { op: 'remove'; path: string }
  | { op: 'move' | 'copy'; path: string; from: string };

function isObject(value: Json): value is { [key: string]: Json } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone<T extends Json>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (isObject(value)) {
    const result: Record<string, Json> = Object.create(null) as Record<string, Json>;
    for (const [key, item] of Object.entries(value)) result[key] = clone(item);
    return result as T;
  }
  return value;
}

function equal(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => equal(value, b[i]!));
  }
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a);
    return (
      aKeys.length === Object.keys(b).length &&
      aKeys.every((key) => key in b && equal(a[key]!, b[key]!))
    );
  }
  return false;
}

function pointer(path: string): string[] {
  if (path === '') return [];
  if (!path.startsWith('/'))
    throw new Error(`Invalid JSON Pointer "${path}": paths must start with /.`);
  return path
    .slice(1)
    .split('/')
    .map((part) => {
      if (/~(?![01])/.test(part)) throw new Error(`Invalid escape in JSON Pointer "${path}".`);
      return part.replace(/~1/g, '/').replace(/~0/g, '~');
    });
}

function arrayIndex(segment: string, length: number, allowEnd: boolean): number {
  if (!/^(0|[1-9]\d*)$/.test(segment)) throw new Error(`Invalid array index "${segment}".`);
  const index = Number(segment);
  if (!Number.isSafeInteger(index) || index > length || (!allowEnd && index === length)) {
    throw new Error(`Array index "${segment}" is out of bounds.`);
  }
  return index;
}

function get(root: Json, parts: string[]): Json {
  let value = root;
  for (const part of parts) {
    if (Array.isArray(value)) value = value[arrayIndex(part, value.length, false)]!;
    else if (isObject(value) && Object.prototype.hasOwnProperty.call(value, part))
      value = value[part]!;
    else throw new Error(`Path segment "${part}" does not exist.`);
  }
  return value;
}

function parentAt(root: Json, parts: string[]): { parent: Json; key: string } {
  if (!parts.length) throw new Error('The document root has no parent path.');
  return { parent: get(root, parts.slice(0, -1)), key: parts.at(-1)! };
}

function add(root: Json, parts: string[], value: Json): Json {
  if (!parts.length) return clone(value);
  const { parent, key } = parentAt(root, parts);
  if (Array.isArray(parent)) {
    if (key === '-') parent.push(clone(value));
    else parent.splice(arrayIndex(key, parent.length, true), 0, clone(value));
  } else if (isObject(parent)) parent[key] = clone(value);
  else throw new Error('The target parent is not an object or array.');
  return root;
}

function replace(root: Json, parts: string[], value: Json): Json {
  if (!parts.length) return clone(value);
  const { parent, key } = parentAt(root, parts);
  if (Array.isArray(parent)) parent[arrayIndex(key, parent.length, false)] = clone(value);
  else if (isObject(parent) && Object.prototype.hasOwnProperty.call(parent, key))
    parent[key] = clone(value);
  else throw new Error(`Path "${key}" does not exist.`);
  return root;
}

function remove(root: Json, parts: string[]): { root: Json; removed: Json } {
  if (!parts.length) return { root: null, removed: root };
  const { parent, key } = parentAt(root, parts);
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, false);
    return { root, removed: parent.splice(index, 1)[0]! };
  }
  if (isObject(parent) && Object.prototype.hasOwnProperty.call(parent, key)) {
    const removed = parent[key]!;
    delete parent[key];
    return { root, removed };
  }
  throw new Error(`Path "${key}" does not exist.`);
}

function parseJson(text: string, label: string): Json {
  try {
    return JSON.parse(text) as Json;
  } catch (error) {
    throw new ToolError(
      `Invalid JSON in ${label}.`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function parseOperations(value: Json): PatchOperation[] {
  if (!Array.isArray(value)) throw new ToolError('Patch must be a JSON array of operations.');
  return value.map((item, index) => {
    const fail = (reason: string): never => {
      throw new ToolError(`Invalid patch operation ${index + 1}.`, reason);
    };
    if (!isObject(item) || typeof item.op !== 'string' || typeof item.path !== 'string') {
      return fail('Each operation must be an object with string "op" and "path" fields.');
    }
    const op = item.op;
    if (op === 'add' || op === 'replace' || op === 'test') {
      if (!Object.prototype.hasOwnProperty.call(item, 'value'))
        return fail(`Operation "${op}" requires a value field.`);
      return { op, path: item.path, value: item.value! };
    }
    if (op === 'remove') return { op, path: item.path };
    if (op === 'move' || op === 'copy') {
      if (typeof item.from !== 'string')
        return fail(`Operation "${op}" requires a string from field.`);
      return { op, path: item.path, from: item.from };
    }
    return fail(`Unsupported operation "${op}".`);
  });
}

function applyPatch(document: Json, operations: PatchOperation[]): Json {
  let result = clone(document);
  operations.forEach((operation, index) => {
    try {
      const path = pointer(operation.path);
      switch (operation.op) {
        case 'add':
          result = add(result, path, operation.value);
          break;
        case 'remove':
          result = remove(result, path).root;
          break;
        case 'replace':
          result = replace(result, path, operation.value);
          break;
        case 'copy': {
          const value = clone(get(result, pointer(operation.from)));
          result = add(result, path, value);
          break;
        }
        case 'move': {
          const from = pointer(operation.from);
          if (path.length > from.length && from.every((part, i) => path[i] === part)) {
            throw new Error('A value cannot be moved into one of its descendants.');
          }
          const removed = remove(result, from);
          result = removed.root;
          result = add(result, pointer(operation.path), removed.removed);
          break;
        }
        case 'test':
          if (!equal(get(result, path), operation.value))
            throw new Error('The test value does not match.');
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ToolError(
        `Patch operation ${index + 1} (${operation.op} ${operation.path}) failed.`,
        message,
      );
    }
  });
  return result;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  if (!input.text.trim()) throw new ToolError('Enter a JSON document to patch.');
  const document = parseJson(input.text, 'the document');
  const patchText = String(options.patch ?? '').trim();
  if (!patchText) throw new ToolError('Enter at least one JSON Patch operation.');
  const operations = parseOperations(parseJson(patchText, 'the patch'));

  const indentation = String(options.indent);
  const space: number | string =
    indentation === 'tab' ? '\t' : indentation === '0' ? 0 : Number(indentation);
  if (space !== 0 && space !== '\t' && space !== 2 && space !== 4) {
    throw new ToolError('Choose a valid output indentation.');
  }

  const result = applyPatch(document, operations);
  return {
    output: JSON.stringify(result, null, space),
    render: 'code',
    language: 'json',
    filename: 'patched.json',
    stats: { operations: operations.length, 'output characters': JSON.stringify(result).length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
