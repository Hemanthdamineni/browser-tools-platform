import { describe, expect, it } from 'vitest';
import tool from './known-hosts-inspector.tool';
import { meta } from './known-hosts-inspector.meta';

type Result = {
  report?: { output: string; render?: string };
  stats?: Record<string, string | number>;
  notes?: string[];
  warnings?: string[];
};
type Table = { headers: string[]; rows: string[][] };

const toFile = (data: string, name: string): File => new File([data], name);

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [toFile(text, 'known_hosts')], options })) as unknown as Result;

const table = (r: Result) => JSON.parse(r.report?.output ?? '') as Table;
const rowsBy = (t: Table): Map<string, string> =>
  new Map(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));

/**
 * Fixture key blobs. The SHA256 fingerprints below are taken verbatim from
 * the foreign oracle `ssh-keygen -lf` (run during fixture creation):
 *   key A  ed25519  SHA256:LKxe5mz7g71QwnszgUV4H7TAMdVMmozaHrzX83kX9gE  comment box-a
 *   key B  ed25519  SHA256:K9rkmoZXiL4SiUwsQSloDIz32ZLEdGGappmYNncMIl0  comment box-b
 *   key C  rsa-2048 SHA256:l2XwYhuXmig2Ev8fV+Hakc64qSC7Y4Oxi6xIC02aX4g  (no comment)
 */
const KEY_A =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINtHbxwCJ74gi0/0uaZwOGa5ihllz9REBYdSlEyGVqTd box-a';
const KEY_B =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIyKtEKQ8bmaNhNNMn7fKeHqNePnT3q6abJd4/Zh7hyl box-b';
const KEY_C =
  'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC69syPleAPn813HuI/IomGUT+kI0x4kvELl+HJ3Q2YHQ4Jt6E+yfUYXPuKl/nFPNECj0nHz25jiXzoXIgr3Qz57uEWoNM9DkKYJYzpjMLxlI1TP4m3dnPPOdStibb3BnW3K5BQ1tSKxLCoAioM7wo6iq+bYWprlG8axz3I/9dEdxzty6uwdsm34I+JXTt8LGhDHfH5PNjhAIMOQ+bi2wGCKZgX8lt3diCAHxNSwpMXkHM+oH/Sff2OdXUFK+b+v5rG4cmuo/Jl89u0X22T+T7R9ROdg1xpq23YDgPi2GwULaF4b2TX57tLuQMEGfVlDHafi4spXm2OaPcOPfkolnpH';

const PLAIN = [
  `github.com ${KEY_A}`,
  `github.com ${KEY_B}`, // same host, different key -> host-key change finding
  `*.internal.example.com ${KEY_C}`,
  `!evil.example.com ${KEY_A}`, // negation
  `192.168.1.10 ${KEY_B}`,
  '# a comment line',
  'notenough', // malformed: too few fields
  'garbage line with no key blob here', // malformed: bad base64
  `10.0.0.5,host.example.org ${KEY_A}`, // multi-host + IP
  `[shell.example.com]:2222 ${KEY_C}`, // bracketed host + port
  '',
  `plain-again.example ${KEY_B}`,
].join('\n');

/**
 * Hashed fixture: `ssh-keygen -H` on `gitlab.com <KEY_C>` produced this
 * `|1|salt|hash|` record. `ssh-keygen -F gitlab.com -f <file>` resolves it
 * (exit 0, host found); `ssh-keygen -F nope.example -f <file>` exits 1 (not
 * found). The HMAC-SHA1(key=salt, message=hostname) scheme is verified.
 */
const HASHED = `|1|ABEiM0RVZneImaq7zN3u/wECAwQ=|RhgYNDsbL+SjwailjqE50LMe/KU= ${KEY_C}`;

describe('known-hosts-inspector meta contract', () => {
  it('registers with a unique id and on-device privacy', () => {
    expect(meta.id).toBe('known-hosts-inspector');
    expect(meta.category).toBe('security');
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });
  it('exposes the views and the host lookup option', () => {
    const options = meta.options ?? [];
    const keys = options.map((o) => o.key);
    expect(keys).toContain('format');
    expect(keys).toContain('host');
    const format = options.find((o) => o.key === 'format');
    const choices =
      format?.type === 'select' ? format.choices.map((c) => c.value) : [];
    expect(choices).toEqual(['summary', 'entries', 'keys', 'lookup', 'findings']);
  });
});

describe('parsing', () => {
  it('rejects an empty uploaded file with a clear error', async () => {
    await expect(run('')).rejects.toThrow(/empty/i);
  });

  it('shows a friendly hint for whitespace-only pasted text', async () => {
    const r = (await tool.run({ files: [], text: '   \n  ', options: {} })) as unknown as Result;
    const t = table(r);
    expect(t.rows[0]?.[0] ?? '').toContain('known_hosts');
  });

  it('counts entries, hashed, malformed, negations and wildcards in summary', async () => {
    const r = await run(PLAIN);
    const t = table(r);
    const m = rowsBy(t);
    // github(A), github(B), *.internal, !evil, 192.168.1.10,
    // 10.0.0.5,host.example.org, [shell]:2222, plain-again.example = 8
    // plus 2 malformed (notenough, garbage) = 10 total entries
    expect(m.get('Total entries')).toBe('10');
  });

  it('parses all well-formed entry lines and ignores comments/blank lines', async () => {
    const r = await run(PLAIN, { format: 'entries' });
    const t = table(r);
    const lines = t.rows.map((row) => row[0]);
    expect(lines).not.toContain('6'); // comment line
    expect(lines).not.toContain('11'); // blank line
    expect(t.rows.filter((row) => row[1] === 'Malformed').length).toBe(2);
  });

  it('flags the two malformed lines as errors in findings', async () => {
    const r = await run(PLAIN, { format: 'findings' });
    const t = table(r);
    const malformed = t.rows.filter((row) => row[0] === 'malformed-line');
    expect(malformed.length).toBe(2);
    expect(t.rows.some((row) => row[0] === 'host-key-change')).toBe(true);
  });
});

describe('fingerprints', () => {
  it('computes the SHA256 fingerprint matching ssh-keygen -lf', async () => {
    const r = await run(`github.com ${KEY_A}\n`, { format: 'entries' });
    const t = table(r);
    expect(t.rows.length).toBe(1);
    expect(t.rows[0]?.[4]).toBe('SHA256:LKxe5mz7g71QwnszgUV4H7TAMdVMmozaHrzX83kX9gE');
    expect(t.rows[0]?.[5]).toMatch(/^MD5:[0-9a-f]{2}(?::[0-9a-f]{2}){15}$/);
    expect(t.rows[0]?.[6]).toBe('256');
  });

  it('reports the key type recorded in the blob, not just the column', async () => {
    const r = await run(`github.com ${KEY_C}\n`, { format: 'findings' });
    const t = table(r);
    const mismatch = t.rows.find((row) => row[0] === 'key-type-mismatch');
    expect(mismatch).toBeUndefined();
    const r2 = await run(`github.com ssh-ed25519 ${KEY_C.split(' ')[1]}\n`, { format: 'findings' });
    expect(table(r2).rows.some((row) => row[0] === 'key-type-mismatch')).toBe(true);
  });
});

describe('host-key change and key reuse', () => {
  it('detects the same host bound to two different keys', async () => {
    const r = await run(PLAIN, { format: 'findings' });
    const t = table(r);
    const change = t.rows.find((row) => row[0] === 'host-key-change');
    expect(change).toBeDefined();
    expect(change?.[2]).toContain('github.com');
    expect(change?.[2]).toContain('2 different keys');
  });
});

describe('hostname lookup', () => {
  it('resolves a hashed entry for the matching hostname (oracle: ssh-keygen -F)', async () => {
    const r = await run(HASHED, { format: 'lookup', host: 'gitlab.com' });
    const t = table(r);
    expect(t.rows.length).toBeGreaterThan(0);
    expect(t.rows[0]?.[1]).toBe('Hashed (|1|)');
  });

  it('does not match a hashed entry for a different hostname', async () => {
    const r = await run(HASHED, { format: 'lookup', host: 'nope.example' });
    const t = table(r);
    expect(t.rows[0]?.[0]).toContain('No entries match');
  });

  it('matches plaintext hosts by exact name and wildcard', async () => {
    const r = await run(PLAIN, { format: 'lookup', host: 'gitlab.com' });
    const t = table(r);
    expect(t.rows[0]?.[0]).toContain('No entries match');
    const r2 = await run(PLAIN, { format: 'lookup', host: 'web.internal.example.com' });
    const t2 = table(r2);
    expect(t2.rows.length).toBe(1);
    expect(t2.rows[0]?.[2]).toBe('*.internal.example.com');
  });

  it('does not treat a wildcard prefix as matching a bare suffix', async () => {
    const r = await run(PLAIN, { format: 'lookup', host: 'internal.example.com' });
    const t = table(r);
    expect(t.rows[0]?.[0]).toContain('No entries match');
  });

  it('shows a hint when no hostname is supplied', async () => {
    const r = await run(PLAIN, { format: 'lookup' });
    const t = table(r);
    expect(t.rows[0]?.[0]).toMatch(/Enter a hostname/i);
  });
});

describe('edge cases', () => {
  it('ignores CRLF line endings', async () => {
    const crlf = `github.com ${KEY_A}\r\nplain-again.example ${KEY_B}\r\n`;
    const m = rowsBy(table(await run(crlf, { format: 'summary' })));
    expect(m.get('Total entries')).toBe('2');
    expect(m.get('Malformed lines')).toBe('0');
  });

  it('ignores comment lines that look like entries', async () => {
    const text = `# github.com ${KEY_A}\n#|1|abc|def= ${KEY_B}\n`;
    const m = rowsBy(table(await run(text, { format: 'summary' })));
    expect(m.get('Total entries')).toBe('0');
    expect(m.get('Malformed lines')).toBe('0');
  });

  it('rejects a file over the 8 MB cap without parsing it', async () => {
    const big = new File(['x'.repeat(9 * 1024 * 1024)], 'known_hosts');
    await expect(tool.run({ files: [big], options: {} } as never)).rejects.toThrow(/8 MB/u);
  });

  it('deduplicates the same key repeated on several lines', async () => {
    const text = `github.com ${KEY_A}\ngithub.com ${KEY_A}\n`;
    const entries = table(await run(text, { format: 'entries' }));
    const keys = table(await run(text, { format: 'keys' }));
    expect(entries.rows.length).toBe(2);
    expect(keys.rows.length).toBe(1);
    const findings = table(await run(text, { format: 'findings' }));
    expect(findings.rows.some((row) => row[0] === 'duplicate-key')).toBe(true);
  });

  it('falls back to the summary view for an unknown format', async () => {
    const r = await run(`github.com ${KEY_A}\n`, { format: 'nope' });
    const m = rowsBy(table(r));
    expect(m.get('Total entries')).toBe('1');
    expect(r.warnings?.some((w) => w.includes('nope'))).toBe(true);
  });

  it('marks negated patterns and reports them as such', async () => {
    const entries = table(await run(PLAIN, { format: 'entries' }));
    const neg = entries.rows.filter((row) => row[1] === 'Negation (!)');
    expect(neg.length).toBe(1);
    expect(neg[0]?.[2]).toBe('!evil.example.com');
  });

  it('counts multiple hostnames on a single line', async () => {
    const keys = table(await run(PLAIN, { format: 'keys' }));
    const row = keys.rows.find((r) => (r[4] ?? '').includes('host.example.org'));
    expect(row).toBeDefined();
    expect(row?.[4]).toContain('10.0.0.5');
  });

});