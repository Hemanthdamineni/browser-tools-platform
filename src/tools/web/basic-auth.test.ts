import { describe, it, expect } from 'vitest';
import tool from './basic-auth.tool';
import { ToolError } from '@/lib/types';

const run = (text = '', options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options });

describe('basic-auth', () => {
  it('builds the RFC 7617 example header', () => {
    const r = run('', { mode: 'build', username: 'Aladdin', password: 'open sesame' });
    expect(r.output).toBe('Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==');
  });

  it('decodes a header with the Authorization prefix', () => {
    const r = run('Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==', { mode: 'decode' });
    expect(r.output).toBe('Username: Aladdin\nPassword: open sesame');
  });

  it('decodes a bare token too', () => {
    const r = run('QWxhZGRpbjpvcGVuIHNlc2FtZQ==', { mode: 'decode' });
    expect(r.output).toBe('Username: Aladdin\nPassword: open sesame');
  });

  it('round-trips a UTF-8 password', () => {
    const built = run('', { mode: 'build', username: 'u', password: 'pä$$' }).output;
    const token = built.replace('Authorization: Basic ', '');
    const decoded = run(token, { mode: 'decode' }).output;
    expect(decoded).toBe('Username: u\nPassword: pä$$');
  });

  it('warns when both fields are blank (encodes ":")', () => {
    const r = run('', { mode: 'build' });
    expect(r.output).toBe('Authorization: Basic Og==');
    expect(r.warnings?.[0]).toMatch(/no username or password/i);
  });

  it('throws ToolError on non-base64 decode input', () => {
    expect(() => run('!!!not base64!!!', { mode: 'decode' })).toThrow(ToolError);
    expect(() => run('!!!not base64!!!', { mode: 'decode' })).toThrow(/valid base64/);
  });

  it('empty decode input gives empty output', () => {
    expect(run('', { mode: 'decode' }).output).toBe('');
  });
});
