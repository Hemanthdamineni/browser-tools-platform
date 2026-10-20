import { describe, expect, it } from 'vitest';
import tool from './yaml-lint.tool';

type Result = { output: string; render?: string; stats?: Record<string, number> };
type Table = { headers: string[]; rows: string[][] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): Table => JSON.parse(r.output) as Table;
const messages = (r: Result): string[] => table(r).rows.map((row) => row[3]!);

describe('yaml-lint', () => {
  it('normalizes a well-formed nested mapping', async () => {
    const r = await run('server:\n  host: localhost\n  ports:\n    - 80\n    - 443\n  debug: true');
    expect(r.render).toBe('code');
    expect(r.output).toContain('server:');
    expect(r.output).toContain('  host: localhost');
    expect(r.output).toContain('  ports:');
    expect(r.output).toContain('    - 80');
    expect(r.output).toContain('  debug: true');
    expect(r.stats?.errors).toBe(0);
  });

  it('lints cleanly and reports duplicate keys as warnings', async () => {
    const r = await run('name: alice\nname: bob\nrole: admin');
    expect(r.render).toBe('table');
    expect(messages(r).join(' ')).toContain('Duplicate key');
    expect(r.stats?.warnings).toBe(1);
  });

  it('rejects tab indentation', async () => {
    const r = await run('a: 1\n\tb: 2');
    expect(messages(r).join(' ')).toContain('Tabs are not allowed');
    expect(r.stats?.errors).toBeGreaterThan(0);
  });

  it('reports unclosed quotes and flow collections', async () => {
    const quote = await run('a: "unterminated');
    expect(messages(quote).join(' ')).toMatch(/Unclosed.*quote/i);
    const flow = await run('a: [1, 2, 3');
    expect(messages(flow).join(' ')).toMatch(/Unclosed.*flow/i);
  });

  it('decodes quoted scalars and strips trailing comments', async () => {
    const r = await run("a: \"hello\"\nb: it's fine  # note\nc: 42");
    expect(r.render).toBe('code');
    expect(r.output).toContain('a: hello');
    expect(r.output).toContain("b: it's fine");
    expect(r.output).not.toContain('# note');
    expect(r.output).toContain('c: 42');
  });

  it('preserves block scalars and flow collections', async () => {
    const r = await run('text: |\n  line one\n  line two\nlist: [1, 2, 3]');
    expect(r.output).toContain('text: |');
    expect(r.output).toContain('line one');
    expect(r.output).toContain('list: [1, 2, 3]');
  });

  it('handles sequences with compact map items', async () => {
    const r = await run('- name: Ada\n  age: 36\n- name: Linus\n  age: 55');
    expect(r.output).toContain('- name: Ada');
    expect(r.output).toContain('  age: 36');
    expect(r.output).toContain('- name: Linus');
  });

  it('accepts a bare flow document and a plain scalar document', async () => {
    const flow = await run('[a, b, c]');
    expect(flow.stats?.errors).toBe(0);
    const scalar = await run('hello');
    expect(scalar.stats?.errors).toBe(0);
  });

  it('reports constructs it does not resolve, rather than misreading them', async () => {
    const alias = await run('base: &b\n  x: 1\ncopy: *b');
    expect(messages(alias).join(' ')).toContain('Anchors and aliases are not supported');
    const tag = await run('value: !!str 5');
    expect(messages(tag).join(' ')).toContain('Explicit tags');
    const docs = await run('---\na: 1\n---\nb: 2');
    expect(messages(docs).join(' ')).toContain('Multi-document');
  });

  it('rejects empty input and bad indent option', async () => {
    await expect(run('   ')).rejects.toThrow(/yaml/i);
    await expect(run('a: 1', { indent: 5 })).rejects.toThrow(/Indent/);
  });
});
