import { describe, expect, it } from 'vitest';
import tool from './ini-convert.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('ini-convert', () => {
  it('parses INI into a typed JSON object', async () => {
    const r = await run(
      'port = 8080\nlog_level = debug\n\n[database]\nhost = localhost\nssl = true',
    );
    const parsed = JSON.parse(r.output) as Record<string, unknown>;
    expect(parsed.port).toBe(8080);
    expect(parsed.log_level).toBe('debug');
    const db = parsed.database as Record<string, unknown>;
    expect(db.host).toBe('localhost');
    expect(db.ssl).toBe(true);
  });

  it('inferTypes numbers, floats and bare keys', async () => {
    const r = await run('count = -3\nratio = 1.5\ndebug\nbig = 1e3');
    const parsed = JSON.parse(r.output) as Record<string, unknown>;
    expect(parsed.count).toBe(-3);
    expect(parsed.ratio).toBe(1.5);
    expect(parsed.debug).toBe(true);
    expect(parsed.big).toBe(1000);
  });

  it('skips comments and blank lines', async () => {
    const r = await run('; a comment\n# another\n\n[a]\n; c\nx = 1');
    const parsed = JSON.parse(r.output) as Record<string, unknown>;
    expect(parsed).toEqual({ a: { x: 1 } });
  });

  it('handles string values containing equals signs and quotes', async () => {
    const r = await run('url = https://x/y?a=1&b=2\nmsg = "hello world"');
    const parsed = JSON.parse(r.output) as Record<string, unknown>;
    expect(parsed.url).toBe('https://x/y?a=1&b=2');
    expect(parsed.msg).toBe('"hello world"');
  });

  it('serializes JSON to INI with sections', async () => {
    const r = await run('{"database":{"host":"localhost","ssl":true},"port":8080}', {
      mode: 'json-to-ini',
    });
    const lines = r.output.trim().split('\n');
    expect(lines).toContain('[database]');
    expect(lines).toContain('host = localhost');
    expect(lines).toContain('ssl = true');
    expect(lines).toContain('port = 8080');
  });

  it('serializes nested objects to dotted sections', async () => {
    const r = await run('{"app":{"db":{"user":"u"}}}', { mode: 'json-to-ini' });
    const lines = r.output.trim().split('\n');
    expect(lines).toContain('[app]');
    expect(lines).toContain('[app.db]');
    expect(lines).toContain('user = u');
  });

  it('serializes arrays to repeated dotted keys', async () => {
    const r = await run('{"hosts":["a","b"]}', { mode: 'json-to-ini' });
    const lines = r.output.trim().split('\n');
    expect(lines).toContain('hosts.0 = a');
    expect(lines).toContain('hosts.1 = b');
  });

  it('round-trips INI through JSON', async () => {
    const ini = 'name = demo\ncount = 2\n[db]\nhost = h';
    const toJson = await run(ini);
    const json = JSON.parse(toJson.output) as Record<string, unknown>;
    const back = await run(JSON.stringify(json), { mode: 'json-to-ini' });
    expect(back.output.trim().split('\n')).toEqual([
      'name = demo',
      'count = 2',
      '[db]',
      'host = h',
    ]);
  });

  it('errors on blank input, invalid JSON, and non-object roots', async () => {
    await expect(run('   ')).rejects.toThrow(/paste/i);
    await expect(run('not json', { mode: 'json-to-ini' })).rejects.toThrow(/invalid json/i);
    await expect(run('[1,2]', { mode: 'json-to-ini' })).rejects.toThrow(/must be an object/i);
    await expect(run('; only a comment')).rejects.toThrow(/no ini content/i);
  });

  it('reports stats', async () => {
    const r = await run('a = 1\nb = x\n[sec]\nc = 2');
    expect(r.stats?.keys).toBe(4);
    expect(r.stats?.sections).toBe(1);
  });
});
