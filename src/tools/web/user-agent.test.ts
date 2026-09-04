import { describe, it, expect } from 'vitest';
import tool from './user-agent.tool';
import { ToolError } from '@/lib/types';

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const run = (text: string) => tool.run({ text, options: {} });
const rows = (r: ReturnType<typeof run>) => (JSON.parse(r.output) as { rows: string[][] }).rows;
const value = (r: ReturnType<typeof run>, field: string) =>
  rows(r).find((row) => row[0] === field)![1];

describe('user-agent', () => {
  it('parses the spec Chrome-on-Windows known answer', () => {
    const r = run(CHROME_WIN);
    expect(value(r, 'Browser')).toBe('Chrome');
    expect(value(r, 'OS')).toBe('Windows');
    expect(value(r, 'OS version')).toBe('10');
    expect(value(r, 'Engine')).toBe('Blink');
    expect(value(r, 'Device type')).toBe('desktop');
    expect(value(r, 'Is bot')).toBe('No');
  });

  it('flags curl as a bot with browser curl', () => {
    const r = run('curl/8.4.0');
    expect(value(r, 'Is bot')).toBe('Yes');
    expect(value(r, 'Browser')).toBe('cURL');
  });

  it('detects Firefox + macOS with OS version from underscores', () => {
    const r = run('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/121.0');
    expect(value(r, 'Browser')).toBe('Firefox');
    expect(value(r, 'OS')).toBe('macOS');
    expect(value(r, 'OS version')).toBe('10.15.7');
    expect(value(r, 'Engine')).toBe('Gecko');
  });

  it('treats Edge explicitly rather than as Chrome', () => {
    const r = run(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.121',
    );
    expect(value(r, 'Browser')).toBe('Edge');
    expect(value(r, 'Is bot')).toBe('No');
  });

  it('detects Googlebot as a bot', () => {
    const r = run('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    expect(value(r, 'Is bot')).toBe('Yes');
    expect(value(r, 'Device type')).toBe('bot');
  });

  it('detects Android mobile with version', () => {
    const r = run(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    );
    expect(value(r, 'OS')).toBe('Android');
    expect(value(r, 'OS version')).toBe('13');
    expect(value(r, 'Device type')).toBe('mobile');
    expect(value(r, 'Browser')).toBe('Chrome');
  });

  it('detects iPhone Safari as iOS tablet/mobile', () => {
    const r = run(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    );
    expect(value(r, 'OS')).toBe('iOS');
    expect(value(r, 'OS version')).toBe('16.6');
  });

  it('throws ToolError on empty input', () => {
    expect(() => run('')).toThrow(ToolError);
    expect(() => run(' ')).toThrow(/Paste a User-Agent string/);
  });
});
