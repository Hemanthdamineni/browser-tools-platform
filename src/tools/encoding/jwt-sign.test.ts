import { describe, it, expect, vi, afterEach } from 'vitest';
import tool from './jwt-sign.tool';
import { ToolError } from '@/lib/types';

interface Result {
  output: string;
  stats?: Record<string, string | number>;
  notes?: string[];
  warnings?: string[];
}

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

/** The canonical token shown on jwt.io for this payload + secret. */
const PAYLOAD = '{"sub":"1234567890","name":"John Doe","iat":1516239022}';
const SECRET = 'your-256-bit-secret';
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

function decodeSegment(segment: string): Record<string, unknown> {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('jwt-sign', () => {
  it('signs the jwt.io reference payload to the exact published token', async () => {
    const out = await run(PAYLOAD, { secret: SECRET });
    expect(out.output).toBe(TOKEN);
  });

  it('omits "typ" from the header when disabled', async () => {
    const out = await run('{"sub":"1"}', { secret: 'k', typ: false });
    const header = decodeSegment(out.output.split('.')[0]!);
    expect(header).toEqual({ alg: 'HS256' });
    // {"alg":"HS256"} base64url
    expect(out.output.startsWith('eyJhbGciOiJIUzI1NiJ9.')).toBe(true);
  });

  it('includes typ JWT by default', async () => {
    const header = decodeSegment((await run('{"sub":"1"}', { secret: 'k' })).output.split('.')[0]!);
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('produces the correct HMAC signature lengths for HS384 and HS512', async () => {
    const hs384 = (await run('{"a":1}', { secret: 'k', algorithm: 'HS384' })).output.split('.');
    const hs512 = (await run('{"a":1}', { secret: 'k', algorithm: 'HS512' })).output.split('.');
    expect(decodeSegment(hs384[0]!)).toEqual({ alg: 'HS384', typ: 'JWT' });
    // 48-byte and 64-byte signatures → 64 and 86 base64url chars (no padding).
    expect(hs384[2]).toHaveLength(64);
    expect(hs512[2]).toHaveLength(86);
  });

  it('adds iat and exp based on the current time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z')); // 1704067200
    const out = await run('{"sub":"1"}', { secret: 'k', addIat: true, expiresIn: 60 });
    const payload = decodeSegment(out.output.split('.')[1]!);
    expect(payload.iat).toBe(1704067200);
    expect(payload.exp).toBe(1704067200 + 60 * 60);
  });

  it('derives exp from an existing iat claim when no iat is added', async () => {
    const out = await run(PAYLOAD, { secret: 'k', expiresIn: 30 });
    const payload = decodeSegment(out.output.split('.')[1]!);
    expect(payload.iat).toBe(1516239022);
    expect(payload.exp).toBe(1516239022 + 30 * 60);
  });

  it('reports stats for the produced token', async () => {
    const out = await run('{"sub":"1"}', { secret: 'k' });
    expect(out.stats?.algorithm).toBe('HS256');
    expect(out.stats?.['token chars']).toBe(out.output.length);
  });

  it('returns empty output for empty input', async () => {
    expect((await run('', { secret: 'k' })).output).toBe('');
  });

  it('rejects a payload that is not valid JSON', async () => {
    await expect(run('{oops}', { secret: 'k' })).rejects.toBeInstanceOf(ToolError);
    await expect(run('{oops}', { secret: 'k' })).rejects.toThrow(/not valid JSON/i);
  });

  it('rejects a payload that is not a JSON object', async () => {
    await expect(run('[1,2,3]', { secret: 'k' })).rejects.toThrow(/must be a JSON object/i);
    await expect(run('"just a string"', { secret: 'k' })).rejects.toBeInstanceOf(ToolError);
  });

  it('requires a secret to sign', async () => {
    await expect(run(PAYLOAD)).rejects.toBeInstanceOf(ToolError);
    await expect(run(PAYLOAD, { secret: '' })).rejects.toThrow(/signing secret/i);
  });

  it('rejects an unsupported algorithm', async () => {
    await expect(run(PAYLOAD, { secret: 'k', algorithm: 'RS256' })).rejects.toThrow(
      /unsupported algorithm/i,
    );
  });

  it('rejects an out-of-range expiry', async () => {
    await expect(run('{"sub":"1"}', { secret: 'k', expiresIn: 1e15 })).rejects.toThrow(
      /expiry is out of range/i,
    );
  });

  describe('verify mode', () => {
    it('accepts the reference token', async () => {
      const out = await run(TOKEN, { mode: 'verify', secret: SECRET });
      expect(out.output).toBe('Signature VALID');
      expect(out.stats?.signature).toBe('valid');
    });

    it('round-trips a freshly signed token for every algorithm', async () => {
      for (const algorithm of ['HS256', 'HS384', 'HS512']) {
        const token = (await run('{"sub":"abc"}', { secret: 'shh', algorithm })).output;
        const out = await run(token, { mode: 'verify', secret: 'shh' });
        expect(out.output).toBe('Signature VALID');
      }
    });

    it('rejects a token whose payload was tampered with', async () => {
      const forgedPayload = btoa('{"sub":"attacker"}')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const parts = TOKEN.split('.');
      const tampered = `${parts[0]}.${forgedPayload}.${parts[2]}`;
      const out = await run(tampered, { mode: 'verify', secret: SECRET });
      expect(out.output).toBe('Signature INVALID');
      expect(out.stats?.signature).toBe('invalid');
    });

    it('rejects a valid token checked against the wrong secret', async () => {
      const out = await run(TOKEN, { mode: 'verify', secret: 'wrong-secret' });
      expect(out.output).toBe('Signature INVALID');
    });

    it('flags an expired token with a warning', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const token = (await run('{"sub":"1"}', { secret: 'k', addIat: true, expiresIn: 1 })).output;
      vi.setSystemTime(new Date('2024-01-01T01:00:00Z'));
      const out = await run(token, { mode: 'verify', secret: 'k' });
      expect(out.output).toBe('Signature VALID');
      expect(out.warnings?.join(' ')).toMatch(/expired/i);
    });

    it('flags a not-yet-valid (nbf) token', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const token = (await run('{"sub":"1","nbf":9999999999}', { secret: 'k' })).output;
      const out = await run(token, { mode: 'verify', secret: 'k' });
      expect(out.warnings?.join(' ')).toMatch(/not valid before/i);
    });

    it('returns empty output for empty input', async () => {
      expect((await run('', { mode: 'verify', secret: 'k' })).output).toBe('');
    });

    it('rejects a token with the wrong number of segments', async () => {
      await expect(run('only.two', { mode: 'verify', secret: 'k' })).rejects.toThrow(
        /three dot-separated parts/i,
      );
    });

    it('rejects a token whose header is not valid JSON', async () => {
      await expect(run('@@@.eyJhIjoxfQ.sig', { mode: 'verify', secret: 'k' })).rejects.toThrow(
        /not valid base64url|not valid JSON/i,
      );
    });

    it('rejects a token signed with an unsupported algorithm', async () => {
      const header = btoa('{"alg":"RS256","typ":"JWT"}')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const payload = btoa('{"sub":"1"}').replace(/=+$/, '');
      await expect(
        run(`${header}.${payload}.sig`, { mode: 'verify', secret: 'k' }),
      ).rejects.toThrow(/cannot verify/i);
    });

    it('does not crash on an out-of-range exp claim', async () => {
      const token = (await run('{"sub":"1","exp":20000000000000}', { secret: 'k' })).output;
      const out = await run(token, { mode: 'verify', secret: 'k' });
      expect(out.output).toBe('Signature VALID');
    });

    it('requires a secret to verify', async () => {
      await expect(run(TOKEN, { mode: 'verify' })).rejects.toBeInstanceOf(ToolError);
      await expect(run(TOKEN, { mode: 'verify', secret: '' })).rejects.toThrow(/secret to verify/i);
    });

    it('still verifies a token that uses a crit header, but warns about it', async () => {
      const b64url = (s: string) =>
        btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', crit: ['b64'] }));
      const payload = b64url('{"sub":"1"}');
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode('k'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const sig = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`)),
      );
      let bin = '';
      for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]!);
      const token = `${header}.${payload}.${b64url(bin)}`;

      const out = await run(token, { mode: 'verify', secret: 'k' });
      expect(out.output).toBe('Signature VALID');
      expect(out.warnings?.join(' ')).toMatch(/crit/i);
    });
  });
});
