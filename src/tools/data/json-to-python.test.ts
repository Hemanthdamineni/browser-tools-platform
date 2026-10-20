import { describe, expect, it } from 'vitest';
import tool from './json-to-python.tool';

type Result = { output: string; language?: string; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const SAMPLE =
  '{"userId": 42, "name": "Ada", "active": true, "tags": ["admin"], "profile": {"bio": "hi", "age": 37}}';

describe('json-to-python', () => {
  it('generates dataclasses with nested models and sensible defaults', async () => {
    const r = await run(SAMPLE);
    expect(r.output).toContain('from __future__ import annotations');
    expect(r.output).toContain('from dataclasses import dataclass, field');
    expect(r.output).toMatch(/@dataclass\s+class Root:/);
    expect(r.output).toContain('    user_id: Optional[int] = 42');
    expect(r.output).toContain("    name: Optional[str] = 'Ada'");
    expect(r.output).toContain('    active: Optional[bool] = True');
    expect(r.output).toContain('    tags: list[str] = field(default_factory=list)');
    expect(r.output).toContain('    profile: Optional[Profile] = None');
    expect(r.output).toMatch(/@dataclass\s+class Profile:/);
    expect(r.output).toContain("    bio: Optional[str] = 'hi'");
    expect(r.language).toBe('python');
    expect(r.stats?.classes).toBe(2);
  });

  it('top-level list of objects becomes a class per item', async () => {
    const r = await run('[{"id": 1, "label": "one"}, {"id": 2, "label": "two"}]', {
      rootName: 'Item',
    });
    expect(r.output).toMatch(/@dataclass\s+class Item:/);
    expect(r.output).toContain('    id: Optional[int] = 1');
    expect(r.output).toContain("    label: Optional[str] = 'one'");
  });

  it('emits TypedDict and controls snake_case', async () => {
    const r = await run('{"userId": 42, "profile": {"age": 37}}', {
      style: 'typeddict',
      useOptional: false,
    });
    expect(r.output).toContain('from typing import Any, TypedDict');
    expect(r.output).toContain('class Root(TypedDict):');
    expect(r.output).toContain('    user_id: int');
    expect(r.output).toContain('    profile: Profile');
    expect(r.output).toContain('class Profile(TypedDict):');
    expect(r.output).toContain('    age: int');
  });

  it('uses str | None when the pipe option is selected', async () => {
    const r = await run('{"a": 1}', { unionSyntax: 'pipe' });
    expect(r.output).toContain('a: int | None = 1');
  });

  it('handles primitives, arrays and null values', async () => {
    const r = await run('{"n": null, "p": 3.5, "tags": ["x"], "obj": {"deep": false}}', {
      useOptional: false,
      snakeCase: false,
    });
    expect(r.output).toContain('n: Optional[Any] = None');
    expect(r.output).toContain('p: float');
    expect(r.output).toContain('tags: list[str] = field(default_factory=list)');
    expect(r.output).toContain('obj: Obj');
    expect(r.output).toContain('deep: bool');
  });

  it('falls back to bare assignments for primitive or empty roots', async () => {
    const emptyList = await run('[]', { rootName: 'Thing' });
    expect(emptyList.output).toContain('Thing = list[Any]');
    const scalar = await run('"hello"', { rootName: 'Name' });
    expect(scalar.output).toContain('Name = str');
  });

  it('deduplicates reused nested shapes', async () => {
    const r = await run('{"a": {"x": 1}, "b": {"y": 2}}');
    const classes = (r.output.match(/^class [A-Z]\w*:/gm) ?? []).length;
    expect(classes).toBe(3); // Root, A, B — the shared inner shape is nothing extra
  });

  it('rejects empty and invalid JSON', async () => {
    await expect(run('   ')).rejects.toThrow(/json/i);
    await expect(run('{"a": }')).rejects.toThrow(/valid JSON/i);
    await expect(run('null')).rejects.toThrow(/empty/i);
  });
});
