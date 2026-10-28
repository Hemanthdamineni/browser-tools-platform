import { describe, it, expect } from 'vitest';
import type { FileRunResult } from '@/lib/types';
import tool from './known-hosts-inspector.tool';

const encoder = new TextEncoder();

/** An OpenSSH `string` field: big-endian u32 length followed by the bytes. */
function sshString(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, false);
  out.set(bytes, 4);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** A syntactically valid ssh-ed25519 blob; `fill` makes each key distinct. */
function ed25519Blob(fill: number): string {
  return toBase64(
    concat(sshString(encoder.encode('ssh-ed25519')), sshString(new Uint8Array(32).fill(fill))),
  );
}

/** An OpenSSH `|1|salt|hash|` host pattern for `host`. */
async function hashedPattern(host: string): Promise<string> {
  const salt = new Uint8Array(20).fill(7);
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ]);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(host)));
  return `|1|${toBase64(salt)}|${toBase64(digest)}|`;
}

async function runWith(text: string, options: Record<string, string> = {}) {
  const file = new File([text], 'known_hosts', { type: 'text/plain' });
  return tool.run({ files: [file], options });
}

function table(result: FileRunResult): { headers: string[]; rows: string[][] } {
  return JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
}

async function sampleText(): Promise<string> {
  const hashed = await hashedPattern('github.com');
  return [
    `alpha.example.com ssh-ed25519 ${ed25519Blob(1)}`,
    `alpha.example.com ssh-ed25519 ${ed25519Blob(2)}`,
    `${hashed} ssh-ed25519 ${ed25519Blob(1)}`,
    'this-line-is-broken',
  ].join('\n');
}

describe('known-hosts-inspector', () => {
  it('summarises plaintext, hashed and malformed entries', async () => {
    const rows = Object.fromEntries(table(await runWith(await sampleText())).rows);
    expect(rows['Total entries']).toBe('4');
    expect(rows['Plaintext entries']).toBe('2');
    expect(rows['Hashed entries (|1|)']).toBe('1');
    expect(rows['Malformed lines']).toBe('1');
    expect(rows['Host-key change findings']).toBe('1');
  });

  it('lists one row per entry', async () => {
    const { rows } = table(await runWith(await sampleText(), { format: 'entries' }));
    expect(rows).toHaveLength(4);
  });

  it('resolves a hashed entry back to the hostname it covers', async () => {
    const { rows } = table(
      await runWith(await sampleText(), { format: 'lookup', host: 'github.com' }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Hashed (|1|)');
  });

  it('reports no match for an unrelated hostname', async () => {
    const { rows } = table(
      await runWith(await sampleText(), { format: 'lookup', host: 'example.org' }),
    );
    expect(rows[0]?.[0]).toContain('No entries match');
  });

  it('reports the host-key change as a finding', async () => {
    const { rows } = table(await runWith(await sampleText(), { format: 'findings' }));
    const kinds = rows.map((row) => row[0]);
    expect(kinds).toContain('host-key-change');
    expect(kinds).toContain('malformed-line');
  });

  it('rejects an empty file with a clear message', async () => {
    await expect(runWith('')).rejects.toThrow('That file is empty.');
  });

  it('asks for input when no file is supplied', async () => {
    const rows = table(await tool.run({ files: [], options: {} })).rows;
    expect(rows[0]?.[0]).toContain('Paste your ~/.ssh/known_hosts');
  });
});
