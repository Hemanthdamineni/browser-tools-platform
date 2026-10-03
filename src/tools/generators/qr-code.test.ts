import { describe, it, expect } from 'vitest';
import tool, { buildPayload } from './qr-code.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output;

const decode = (uri: string) => decodeURIComponent(escape(atob(uri.split(',')[1]!)));

describe('qr-code', () => {
  it('produces a base64 SVG data URI containing rects', () => {
    const out = run('https://example.com');
    expect(out.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = decode(out);
    expect(svg).toContain('<svg');
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThan(5);
  });

  it('wifi payload helper', () => {
    expect(buildPayload('wifi', 'MyNet', { wifiPassword: 'secret', wifiEncryption: 'WPA' })).toBe(
      'WIFI:T:WPA;S:MyNet;P:secret;;',
    );
  });

  it('wifi with nopass omits the password field', () => {
    expect(buildPayload('wifi', 'Cafe', { wifiEncryption: 'nopass' })).toBe(
      'WIFI:T:nopass;S:Cafe;;',
    );
  });

  it('mailto / tel / geo payloads', () => {
    expect(buildPayload('email', 'a@b.io')).toBe('mailto:a@b.io');
    expect(buildPayload('tel', '+15551234')).toBe('tel:+15551234');
    expect(buildPayload('geo', '52.3,4.9')).toBe('geo:52.3,4.9');
  });

  it('empty input still produces a QR (generator)', () => {
    const out = run('');
    expect(out.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('invalid colours throw a ToolError', () => {
    expect(() => run('x', { dark: 'black' })).toThrow(/hex colour/);
    expect(() => run('x', { light: 'rgb(0,0,0)' })).toThrow(/hex colour/);
  });

  it('margin and cellSize change the SVG size', () => {
    const a = decode(run('hi', { cellSize: 4, margin: 2 }));
    const b = decode(run('hi', { cellSize: 8, margin: 2 }));
    const w = (s: string) => Number(s.match(/width="(\d+)"/)![1]);
    expect(w(b)).toBe(2 * w(a));
  });
});
