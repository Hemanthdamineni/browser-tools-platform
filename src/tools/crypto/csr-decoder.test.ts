import { describe, expect, it } from 'vitest';
import tool from './csr-decoder.tool';

type Result = {
  outputs: unknown[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

// Real requests generated with openssl 3.6.5. Every expected value below comes from
// `openssl req -noout -text` and `openssl req -outform DER | sha256sum`, so it is an
// independent oracle rather than a re-encoding of this tool's own output.
const FIXTURES = {
  rsa: "-----BEGIN CERTIFICATE REQUEST-----\nMIIDMjCCAhoCAQAwaTELMAkGA1UEBhMCR0IxDzANBgNVBAgMBkxvbmRvbjEPMA0G\nA1UEBwwGTG9uZG9uMRQwEgYDVQQKDAtFeGFtcGxlIEx0ZDEMMAoGA1UECwwDT3Bz\nMRQwEgYDVQQDDAtleGFtcGxlLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCC\nAQoCggEBAKNOx86QghDfXtJ9VYhQou2aqp1Ue/O9JHld9JZOxD1GpHhL+If9elW4\nOpjB8MwcssYVQqdiZqJ/1jiz5QDSjogUNDc9LykPeMx1XoctSo5ML2m3yjlzEOAq\noVOgtydm3FE9XgKF70oXDNVJ9RiTEjzup+KUHtJzWoKuLMkGemqd3O8qFm7ojxl6\nVJUfpmQV+T2alz4yfYza+6wXcL0jXlTAaOHu5RhB2kMSPirYMTXDOVKtgb5lfwwY\nOUIuG07KsGUYoAVfuMJsey+ASgRPf7KuI6qExX47jhCoBA2hUyABfklIMvil2nCy\nsZwa3m455vIYTBrwlVkhIktdO1LYNq0CAwEAAaCBgzCBgAYJKoZIhvcNAQkOMXMw\ncTBABgNVHREEOTA3ggtleGFtcGxlLmNvbYIPd3d3LmV4YW1wbGUuY29thwTAAAIK\ngRFhZG1pbkBleGFtcGxlLmNvbTAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYI\nKwYBBQUHAwEGCCsGAQUFBwMCMA0GCSqGSIb3DQEBCwUAA4IBAQAsCMfyay3sduBp\nanae8rBVnIKtdLa2lrSJh07r5qvlV9mGzxgG9JZUfCMrF/yc3vy+/QgC0583k/c1\nAPhe1BVvsjAtFGE7+hyX1ic3Af3w7ZE1nLt9u7fvQ77RrSZPZ5B2B2CsRBEN7pdS\nqJnbjOHTXnUeFv3pKbyZRwUROlv0TRvAT4KQUgxt8lm0cCX2noUbWpHaENcTM4JK\nQbBtkip/2BjCRGp/tPRb/FInqpUMZg36wY9O0RTvQyoDn3m1LSrburmGtdV/Xfgi\nplvlHiEh/vB1vNdlqnCg4Zm184+CRwbQ+yDinarT7bhHYPa6vs6Z8kLKyyPFvB9m\n9VvYKgpd\n-----END CERTIFICATE REQUEST-----",
  ec: "-----BEGIN CERTIFICATE REQUEST-----\nMIHTMHsCAQAwGTEXMBUGA1UEAwwOZWMuZXhhbXBsZS5uZXQwWTATBgcqhkjOPQIB\nBggqhkjOPQMBBwNCAASMmZGfWDApT02FXPcncfOoZg2eL97Ba+Flhh26SXrZI3Uc\nEYRJMtw5aFlYmI6CwEUzqnT/SAR4KzfQXGfCn3pGoAAwCgYIKoZIzj0EAwIDSAAw\nRQIgRqJ8Tmt6V5Dm9GB4Wk4SebfJ74sgzt+X10F3M2FB6ZkCIQDZBflkwO9i7cHZ\ny3Fb9IzCHQtF9vMpgrp67OKoZwpv3Q==\n-----END CERTIFICATE REQUEST-----",
  weak: "-----BEGIN CERTIFICATE REQUEST-----\nMIIBWjCBxAIBADAbMRkwFwYDVQQDDBB3ZWFrLmV4YW1wbGUub3JnMIGfMA0GCSqG\nSIb3DQEBAQUAA4GNADCBiQKBgQDEa9scjIExBjzUn03atIbxo69g76n1RykI35++\ndYu3ceNlFNACWPoNfjk398OPlud2/sfNCuraSq3LrIXUSg5k1UAWYAPtivkqDvbF\nJR7k4RLcxkSFscD79/zDpW+H8EYW9KhTl/19e/1Yw3/X5pv7DYv8HQdFbilTL2ZB\nknN2WQIDAQABoAAwDQYJKoZIhvcNAQEFBQADgYEAtLCjscgpld2SNOQmqfIf1JVw\nx3Xgl5vUaa9IHHmC17PF/LRZGIsx6MZIKxOgyg2BbNjtrDE02Eadj8WMn4GQVlgp\ne0uqb08Fr3+Do4/4QF8wRxGylBgcOAe3/gW0QIL8J9em3GHOmjsNHxO+vAibfCW6\nWy3K8E8VqmnqSYqtF4Q=\n-----END CERTIFICATE REQUEST-----",
  ed: "-----BEGIN CERTIFICATE REQUEST-----\nMIGXMEsCAQAwGDEWMBQGA1UEAwwNZWQuZXhhbXBsZS5pbzAqMAUGAytlcAMhADdg\n6l6GzfDZDPE7rX1I2WOedHD9RVOIfpPkXqHUHumdoAAwBQYDK2VwA0EA+AJDwnvN\n3YgHFQgvMSkELSyrG9YMgrEYlRSMCe1Bx1Yq7lz35xVOwPb8SicwgM3r5NHwvWXQ\nPnVaZLIKPgOWAw==\n-----END CERTIFICATE REQUEST-----",
  odd: "-----BEGIN CERTIFICATE REQUEST-----\nMIIChzCCAW8CAQAwGjEYMBYGA1UEAwwPb2RkLmV4YW1wbGUuY29tMIIBIjANBgkq\nhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuv4wP4wKppXncwrMYHhoLgDJOoSXt2uK\ntSGTS7JaAbIU53M4ea6tG2LBOb8HI771/ImtWXJNIRewIXxBIsauxckWVNnl53kg\na2X5vmL1nhq5cQshYblxcaW7DuiWqO8zUch6iwzY8zXRg0NxIcXOzuWcgGKuBNFi\nhCgeTvaCn2Fd2qX3EmyvAjuNTHk6jvMhWI4uQSkTNl4QzUm7YPJhU90wVcN19Mx1\nsiRAJWHgBDpeX+DlP4YpRk+SKRTBUKtztepn4Tw685aQmDjw/w6mS0Ubhne0pOin\nv+acfmt5hYYp+BOetJsNPtP5sUJrJUkCR/wdeKqkRH72NWE3QRllJwIDAQABoCgw\nJgYJKoZIhvcNAQkOMRkwFzAVBgNVHREEDjAMggoxOTIuMC4yLjEwMA0GCSqGSIb3\nDQEBCwUAA4IBAQCfu2iavD8b37pREPYFGZQiMRZ4yi1oSfmZFS5Tc7SDvu29w+aJ\n+fd+3H3TCQNCYm2jHZ3Dv19Nkv+9vLB0VtwLErBhUx0es9DYLL0QHlk5CKLj4HOz\n8daWuGZvC8g0KPhTXdlGDfyMzkmNgq8h8cZn91y83o8PR3VbqMskEVCpzxNq+BPQ\nJsXjk61NyBvd3aXGPQGy+dC3a3RmNql6rHRU2vAs74nrJM4/iuzrVMLTbDMwyqvU\noThmsyvky4J20+WWG0zYOkoO8j9dwsaWjy/Vu/+O/Ae1pc8uuq6iS5FiRm5uq5+w\nFluSSi7MgsNiaOYuNujAoZdQ0jakjf+CSXSD\n-----END CERTIFICATE REQUEST-----",
};

const RSA_FINGERPRINT = "D5:04:91:DD:3E:16:C2:AF:62:DB:FF:40:E1:23:F2:A1:1B:9E:A9:B4:AE:CF:DD:41:C1:C9:6B:79:A9:2D:65:24";

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [], text, options })) as Result;

const view = async (
  text: string,
  format: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Table> => {
  const result = await run(text, { ...options, format });
  return JSON.parse(result.report?.output ?? '{}') as Table;
};

const summary = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  new Map((await view(text, 'summary', options)).rows.map((row) => [row[0] ?? '', row[1] ?? '']));

const problems = (table: Table): string[] => table.rows.map((row) => row[1] ?? '');

const derFromPem = (pem: string): Uint8Array => {
  const body = pem.replace(/-----[^-]+-----/gu, '').replace(/\s+/gu, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const toPem = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  const lines = btoa(binary).match(/.{1,64}/gu) ?? [];
  return '-----BEGIN CERTIFICATE REQUEST-----\n' + lines.join('\n') + '\n-----END CERTIFICATE REQUEST-----';
};

const findBytes = (haystack: Uint8Array, needle: string): number => {
  const target = Array.from(needle, (character) => character.charCodeAt(0));
  for (let index = 0; index + target.length <= haystack.length; index += 1) {
    if (target.every((byte, offset) => haystack[index + offset] === byte)) return index;
  }
  return -1;
};

// A small DER encoder written from the PKCS#10 layout in RFC 2986, used to build
// requests that openssl will not produce (for example a Common Name over 64 characters)
// and to check the parser against an encoder that does not share its code.
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const derLength = (length: number): Uint8Array => {
  if (length < 0x80) return new Uint8Array([length]);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
};

const tlv = (tag: number, content: Uint8Array): Uint8Array =>
  concat(new Uint8Array([tag]), derLength(content.length), content);
const seq = (...parts: Uint8Array[]): Uint8Array => tlv(0x30, concat(...parts));
const set = (...parts: Uint8Array[]): Uint8Array => tlv(0x31, concat(...parts));
const utf8 = (text: string): Uint8Array => tlv(0x0c, new TextEncoder().encode(text));
const oid = (bytes: number[]): Uint8Array => tlv(0x06, new Uint8Array(bytes));
const integer = (value: number): Uint8Array => tlv(0x02, new Uint8Array([value]));
const nullValue = (): Uint8Array => tlv(0x05, new Uint8Array(0));
const bitString = (bytes: number[]): Uint8Array => tlv(0x03, new Uint8Array([0, ...bytes]));

const OID_RSA_ENCRYPTION = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
const OID_SHA256_RSA = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b];

const buildCsr = (
  options: { version?: number; commonName?: string; attributeOid?: number[]; extraAttributes?: number } = {},
): string => {
  const attribute = options.attributeOid ?? [0x55, 0x04, 0x03];
  const rdn = set(seq(oid(attribute), utf8(options.commonName ?? 'synthetic.example')));
  const extra: Uint8Array[] = [];
  for (let index = 0; index < (options.extraAttributes ?? 0); index += 1) {
    extra.push(set(seq(oid(attribute), utf8('field' + index))));
  }
  const info = seq(
    integer(options.version ?? 0),
    seq(rdn, ...extra),
    seq(seq(oid(OID_RSA_ENCRYPTION), nullValue()), bitString([0x30, 0x03, 0x02, 0x01, 0x01])),
  );
  const request = seq(info, seq(oid(OID_SHA256_RSA), nullValue()), bitString([0xaa, 0xbb, 0xcc]));
  const binary = Array.from(request, (byte) => String.fromCharCode(byte)).join('');
  const lines = btoa(binary).match(/.{1,64}/gu) ?? [];
  return '-----BEGIN CERTIFICATE REQUEST-----\n' + lines.join('\n') + '\n-----END CERTIFICATE REQUEST-----';
};

describe('csr-decoder', () => {
  it('decodes the subject of a real RSA request', async () => {
    const table = await view(FIXTURES.rsa, 'subject');
    expect(table.headers).toEqual(['Field', 'Short', 'Value']);
    expect(table.rows).toEqual([
      ['Country', 'C', 'GB'],
      ['State or Province', 'ST', 'London'],
      ['Locality', 'L', 'London'],
      ['Organization', 'O', 'Example Ltd'],
      ['Organizational Unit', 'OU', 'Ops'],
      ['Common Name', 'CN', 'example.com'],
    ]);
  });

  it('decodes the key and signature algorithm of a real RSA request', async () => {
    const map = await summary(FIXTURES.rsa);
    expect(map.get('Key algorithm')).toBe('RSA');
    expect(map.get('Key size')).toBe('2048 bits');
    expect(map.get('Signature algorithm')).toBe('sha256WithRSAEncryption');
    expect(map.get('Version')).toBe('0');
    expect(map.get('Common Name')).toBe('example.com');
  });

  it('lists every subject alt name with its type', async () => {
    const map = await summary(FIXTURES.rsa);
    expect(map.get('Subject alt names')).toBe(
      'DNS:example.com, DNS:www.example.com, IP:192.0.2.10, email:admin@example.com',
    );
  });

  it('decodes the requested extensions', async () => {
    const table = await view(FIXTURES.rsa, 'extensions');
    expect(table.rows).toEqual([
      ['subjectAltName', 'no', 'DNS:example.com, DNS:www.example.com, IP:192.0.2.10, email:admin@example.com'],
      ['keyUsage', 'yes', 'digitalSignature, keyEncipherment'],
      ['extendedKeyUsage', 'no', 'serverAuth, clientAuth'],
    ]);
  });

  it('verifies the signature of an untouched request', async () => {
    const result = await run(FIXTURES.rsa);
    expect(result.stats?.signature).toBe('valid');
    expect((await summary(FIXTURES.rsa)).get('Signature check')).toBe('valid (signed by the key in this request)');
  });

  it('matches the SHA-256 fingerprint that openssl computes', async () => {
    expect((await summary(FIXTURES.rsa)).get('SHA-256 fingerprint')).toBe(RSA_FINGERPRINT);
  });

  it('reports the DER size it actually parsed', async () => {
    const result = await run(FIXTURES.rsa);
    const der = derFromPem(FIXTURES.rsa);
    expect(result.stats?.derBytes).toBe(der.length);
    expect((await summary(FIXTURES.rsa)).get('DER size')).toBe(der.length + ' bytes');
  });

  it('detects a tampered request', async () => {
    const bytes = derFromPem(FIXTURES.rsa);
    const index = findBytes(bytes, 'example.com');
    expect(index).toBeGreaterThan(0);
    bytes[index] = (bytes[index] ?? 0) ^ 0x01;
    const tampered = toPem(bytes);

    const result = await run(tampered);
    expect(result.stats?.signature).toBe('invalid');
    expect((await summary(tampered)).get('Common Name')).toBe('dxample.com');
    expect(problems(await view(tampered, 'findings'))).toContain('The signature does not match the key');
    expect(result.warnings?.join(' ')).toMatch(/must be fixed before signing/i);
  });

  it('decodes an EC request and its curve', async () => {
    const map = await summary(FIXTURES.ec);
    expect(map.get('Key algorithm')).toBe('EC');
    expect(map.get('Curve')).toBe('prime256v1 (P-256)');
    expect(map.get('Key size')).toBe('256 bits');
    expect(map.get('Signature algorithm')).toBe('ecdsa-with-SHA256');
    expect((await run(FIXTURES.ec)).stats?.signature).toBe('valid');
  });

  it('warns when a request has no subjectAltName', async () => {
    const table = await view(FIXTURES.ec, 'findings');
    expect(problems(table)).toContain('No subjectAltName extension');
    expect(problems(table)).toContain('The request asks for no extensions');
  });

  it('flags a weak key and a weak hash', async () => {
    const weak = problems(await view(FIXTURES.weak, 'findings'));
    expect(weak).toContain('RSA key is only 1024 bits');
    expect(weak).toContain('The signature uses SHA-1');
    const map = await summary(FIXTURES.weak);
    expect(map.get('Key size')).toBe('1024 bits');
    expect(map.get('Signature algorithm')).toBe('sha1WithRSAEncryption');
    expect((await run(FIXTURES.weak)).stats?.signature).toBe('valid');
  });

  it('decodes an Ed25519 request', async () => {
    const map = await summary(FIXTURES.ed);
    expect(map.get('Key algorithm')).toBe('Ed25519');
    expect(map.get('Key size')).toBe('256 bits');
    expect(map.get('Signature algorithm')).toBe('ED25519');
    expect((await run(FIXTURES.ed)).stats?.signature).toBe('valid');
  });

  it('flags an IP address stored in a dNSName entry', async () => {
    expect(problems(await view(FIXTURES.odd, 'findings'))).toContain('IP address stored as a dNSName');
  });

  it('accepts bare base64 and hex DER as well as PEM', async () => {
    const bare = FIXTURES.ec.replace(/-----[^-]+-----/gu, '').replace(/\s+/gu, '');
    expect((await summary(bare)).get('Key algorithm')).toBe('EC');

    const bytes = derFromPem(FIXTURES.ec);
    const asHex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const result = await run(asHex);
    expect(result.stats?.keyBits).toBe(256);
    expect((await summary(asHex)).get('Curve')).toBe('prime256v1 (P-256)');
  });

  it('reads a request from a File', async () => {
    const file = new File([FIXTURES.rsa], 'example.csr', { type: 'application/pkcs10' });
    const result = (await tool.run({ files: [file], options: {} })) as Result;
    expect(result.stats?.keyBits).toBe(2048);
    expect(result.stats?.signature).toBe('valid');
    expect(result.stats?.sanEntries).toBe(4);
  });

  it('can skip the signature check', async () => {
    const result = await run(FIXTURES.rsa, { verifySignature: false });
    expect(result.stats?.signature).toBe('skipped');
    expect((await summary(FIXTURES.rsa, { verifySignature: false })).get('Signature check')).toBe('not checked');
    expect(result.notes?.join(' ')).toMatch(/verification was switched off/i);
    expect(problems(await view(FIXTURES.rsa, 'findings', { verifySignature: false }))).not.toContain(
      'The signature could not be checked here',
    );
  });

  it('reads a hand-built request that openssl refuses to create', async () => {
    const long = buildCsr({ commonName: 'x'.repeat(70) });
    const map = await summary(long, { verifySignature: false });
    expect(map.get('Common Name')).toBe('x'.repeat(70));
    expect(problems(await view(long, 'findings', { verifySignature: false }))).toContain(
      'Common Name is longer than 64 characters',
    );
  });

  it('rejects a version other than zero', async () => {
    const bad = buildCsr({ version: 1 });
    const result = await run(bad, { verifySignature: false });
    expect(result.stats?.errors).toBe(1);
    expect(problems(await view(bad, 'findings', { verifySignature: false }))).toContain('Unsupported version 1');
  });

  it('reports an unknown subject attribute by OID', async () => {
    const odd = buildCsr({ commonName: 'mystery.example', attributeOid: [0x2a, 0x03, 0x04, 0x05] });
    const table = await view(odd, 'subject', { verifySignature: false });
    expect(table.rows).toEqual([['Unknown attribute', '1.2.3.4.5', 'mystery.example']]);
    expect(problems(await view(odd, 'findings', { verifySignature: false }))).toContain(
      'Unrecognised subject attribute',
    );
  });

  it('warns when the subject is empty', async () => {
    const bare = buildCsr({ commonName: '' });
    expect(problems(await view(bare, 'findings', { verifySignature: false }))).toContain('No Common Name');
  });

  it('stays bounded on a request with thousands of fields', async () => {
    const huge = buildCsr({ attributeOid: [0x2a, 0x03, 0x04, 0x05], extraAttributes: 1500 });
    const result = await run(huge, { verifySignature: false });
    expect(result.stats?.subjectFields).toBe(1501);
    const findings = await view(huge, 'findings', { verifySignature: false });
    expect(findings.rows.length).toBe(300);
    expect(result.notes?.join(' ')).toMatch(/findings list stops at 300 entries/i);
    expect((await view(huge, 'subject', { verifySignature: false })).rows.length).toBe(200);
    expect(result.notes?.join(' ')).toMatch(/first 200 subject fields are listed/i);
    expect(JSON.stringify(result.report?.output).length).toBeLessThan(200_000);
  });

  it('says clearly when a certificate was pasted instead of a request', async () => {
    const certificate = [
      '-----BEGIN CERTIFICATE-----',
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA',
      '-----END CERTIFICATE-----',
    ].join('\n');
    await expect(run(certificate)).rejects.toThrow(/certificate, not a certificate request/i);
  });

  it('rejects a PEM block with an unexpected label', async () => {
    const key = ['-----BEGIN PRIVATE KEY-----', 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC', '-----END PRIVATE KEY-----'].join(
      '\n',
    );
    await expect(run(key)).rejects.toThrow(/labelled "PRIVATE KEY"/i);
  });

  it('rejects input that is not a request at all', async () => {
    await expect(run('not base64 at all !!!')).rejects.toThrow(/not valid PEM, base64 or hex/i);
    await expect(run('AAAA')).rejects.toThrow(/not a valid PKCS#10/i);
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/no certificate request was provided/i);
  });

  it('reports findings with a level, problem and detail', async () => {
    const table = await view(FIXTURES.rsa, 'findings');
    expect(table.headers).toEqual(['Level', 'Problem', 'Detail']);
    for (const row of table.rows) {
      expect(row[0]).toMatch(/^(error|warning|note|ok)$/u);
      expect((row[1] ?? '').length).toBeGreaterThan(0);
      expect((row[2] ?? '').length).toBeGreaterThan(5);
    }
  });

  it('summarizes a request it has no complaints about', async () => {
    const map = await summary(FIXTURES.rsa);
    expect(map.get('Errors')).toBe('0');
    expect(map.get('Warnings')).toBe('0');
    expect(map.get('Notes')).toBe('0');
    expect(map.get('Requested extensions')).toBe('3');
    expect(map.get('Attributes')).toBe('none');
  });
});
