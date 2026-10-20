import { describe, expect, it } from 'vitest';
import tool from './ua-parser.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const props = (r: Result): Record<string, string> =>
  Object.fromEntries((JSON.parse(r.output) as { headers: string[]; rows: string[][] }).rows.map(([k, v]) => [k, v!]));

describe('ua-parser', () => {
  it('parses Chrome on Windows 10', async () => {
    const r = await run(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    const p = props(r);
    expect(p['Browser']).toBe('Chrome');
    expect(p['Version']).toMatch(/^120\./);
    expect(p['Engine']).toBe('Blink');
    expect(p['OS']).toBe('Windows');
    expect(p['OS version']).toBe('10/11');
    expect(p['Device']).toBe('Desktop');
  });

  it('parses Firefox on macOS with underscore version', async () => {
    const r = await run(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    );
    const p = props(r);
    expect(p['Browser']).toBe('Firefox');
    expect(p['Version']).toBe('121.0');
    expect(p['Engine']).toBe('Gecko');
    expect(p['OS']).toBe('macOS');
  });

  it('distinguishes Edge from Chrome (Edg token)', async () => {
    const r = await run(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91',
    );
    expect(props(r)['Browser']).toBe('Microsoft Edge');
  });

  it('detects mobile Chrome on Android', async () => {
    const r = await run(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    );
    const p = props(r);
    expect(p['OS']).toBe('Android');
    expect(p['OS version']).toBe('13');
    expect(p['Device']).toBe('Mobile');
  });

  it('detects iPhone Safari with underscore iOS version', async () => {
    const r = await run(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    );
    const p = props(r);
    expect(p['OS']).toBe('iOS');
    expect(p['OS version']).toBe('17.2');
    expect(p['Device']).toBe('Mobile');
  });

  it('labels bots', async () => {
    const r = await run('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    expect(props(r)['Device']).toBe('Bot');
    expect(props(r)['Browser']).toMatch(/Googlebot/i);
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a user-agent/i);
  });
});
