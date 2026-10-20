import { describe, expect, it } from 'vitest';
import tool from './css-minifier.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('css-minifier', () => {
  it('collapses whitespace and drops the last semicolon', async () => {
    const r = await run('.btn {\n  color: #fff;\n  padding: 8px 12px;\n}');
    expect(r.output).toBe('.btn{color:#fff;padding:8px 12px}');
    expect(r.render).toBe('code');
  });

  it('strips normal comments and keeps /*! banners by default', async () => {
    const r = await run('/*! license */\n/* gone */\na { color: red; }');
    expect(r.output).toBe('/*! license */a{color:red}');
    expect(r.stats?.removedComments).toBe(1);
    const off = await run('/*! license */\na { color: red; }', { keepImportantComments: false });
    expect(off.output).toBe('a{color:red}');
  });

  it('preserves spaces around + and - inside calc', async () => {
    const r = await run('.g {\n  width: calc(100% - 32px);\n  height: calc(1px + 2px);\n}');
    expect(r.output).toBe('.g{width:calc(100% - 32px);height:calc(1px + 2px)}');
  });

  it('keeps a minus that introduces a negative value', async () => {
    const r = await run('.g { margin: 0 -4px; }');
    expect(r.output).toBe('.g{margin:0 -4px}');
  });

  it('copies strings verbatim including braces and spacing', async () => {
    const r = await run('.a { content: "  x { }  "; font-family: \'Noto Sans\'; }');
    expect(r.output).toBe('.a{content:"  x { }  ";font-family:\'Noto Sans\'}');
  });

  it('keeps url() payload intact', async () => {
    const r = await run('.a { background: url( "img/a b.png" ) no-repeat; }');
    expect(r.output).toBe('.a{background:url("img/a b.png") no-repeat}');
  });

  it('trims space around combinators but keeps descendant gaps', async () => {
    const r = await run('div > p + span ~ a\n b { color: red; }');
    expect(r.output).toBe('div>p+span~a b{color:red}');
  });

  it('normalizes @media conditions', async () => {
    const r = await run('@media screen and (min-width: 600px) {\n  a { color: red; }\n}');
    expect(r.output).toBe('@media screen and (min-width:600px){a{color:red}}');
  });

  it('removes empty rules, including nested shells', async () => {
    const r = await run('a {}\n@media screen { b { } }\nc { color: red; }');
    expect(r.output).toBe('c{color:red}');
    expect(r.stats?.removedRules).toBeGreaterThanOrEqual(2);
    const keep = await run('a {}\nc { color: red; }', { removeEmptyRules: false });
    expect(keep.output).toBe('a{}c{color:red}');
  });

  it('does not treat braces inside strings as empty rules', async () => {
    const r = await run('.a { content: "{}"; }');
    expect(r.output).toBe('.a{content:"{}"}');
    expect(r.stats?.removedRules).toBe(0);
  });

  it('reports byte savings', async () => {
    const src = '.a {\n  color: red;\n}\n';
    const r = await run(src);
    expect(r.stats?.originalBytes).toBeGreaterThan(r.stats?.minifiedBytes ?? 0);
    expect(r.stats?.savedPercent).toBeGreaterThan(0);
    expect(r.notes?.join(' ')).toMatch(/smaller/);
  });

  it('errors on empty input', async () => {
    await expect(run('   \n  ')).rejects.toThrow(/css/i);
  });

  it('keeps !important compact', async () => {
    const r = await run('.a { color: red !important; }');
    expect(r.output).toBe('.a{color:red!important}');
  });
});
