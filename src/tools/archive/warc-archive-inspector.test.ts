import { describe, expect, it } from 'vitest';
import tool from './warc-archive-inspector.tool';
import { meta } from './warc-archive-inspector.meta';

type Result = {
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

const table = (r: Result): Table => JSON.parse(r.report?.output ?? '') as Table;
const kv = (t: Table): Map<string, string> => new Map(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));

/**
 * The fixture is written by an independent Python WARC writer and walked by an
 * independent Python reader; both values below come from that walker, not from
 * this parser:
 *
 * The byte strings the tests build here are 886 bytes. Offsets below were
 * computed by an independent Python walker over exactly these bytes:
 *
 *     file header block   offset 0,   74 bytes  Software-Info test-writer/1.0
 *     record 0 warcinfo   offset 74,  content-length 14,  total 208
 *     record 1 request    offset 282, content-length 37,  total 272
 *     record 2 response   offset 554, content-length 95,  total 332, HTTP 200 OK
 *     consumed exactly 886 bytes, 0 leftovers
 */

const FILE_HEADER =
  'WARC/1.0\r\nSoftware-Info: test-writer/1.0\r\nFormat: WARC File Format 1.0\r\n\r\n';

function record(
  type: string,
  extra: Record<string, string>,
  content: string,
): string {
  const lines = [
    'WARC/1.0',
    `WARC-Type: ${type}`,
    'WARC-Date: 2024-05-01T12:00:00Z',
    'WARC-Record-ID: <urn:uuid:11111111-2222-3333-4444-555555555555>',
  ];
  for (const [key, value] of Object.entries(extra)) lines.push(`${key}: ${value}`);
  lines.push(`Content-Length: ${content.length}`);
  return `${lines.join('\r\n')}\r\n\r\n${content}\r\n\r\n`;
}

const INFO = record('warcinfo', { 'Content-Type': 'application/warc-fields' }, 'operator: me\r\n');
const REQUEST = record(
  'request',
  { 'Target-URI': 'http://example.com/', 'Content-Type': 'application/http;msgtype=request' },
  'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n',
);
const RESPONSE_BODY = '<html><body>hello</body></html>';
const RESPONSE = record(
  'response',
  { 'Target-URI': 'http://example.com/', 'Content-Type': 'application/http;msgtype=response' },
  `HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: ${RESPONSE_BODY.length}\r\n\r\n${RESPONSE_BODY}`,
);

const WARC = FILE_HEADER + INFO + REQUEST + RESPONSE;

const bytesOf = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

const toFile = (data: Uint8Array, name = 'test.warc'): File =>
  new File([data.buffer as ArrayBuffer], name);

const run = async (data: Uint8Array, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [toFile(data)], options } as never)) as unknown as Result;

/** gzip-compress using the same DecompressionStream family the tool uses. */
async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

describe('warc-archive-inspector meta contract', () => {
  it('registers with a unique id, on-device privacy and a short summary', () => {
    expect(meta.id).toBe('warc-archive-inspector');
    expect(meta.category).toBe('archive');
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });

  it('offers five views plus a row cap', () => {
    const options = meta.options ?? [];
    expect(options.map((o) => o.key)).toEqual(['format', 'maxRows']);
    const format = options.find((o) => o.key === 'format');
    const choices = format?.type === 'select' ? format.choices.map((c) => c.value) : [];
    expect(choices).toEqual(['summary', 'records', 'uris', 'responses', 'findings']);
  });
});

describe('record boundaries match the Python walker', () => {
  it('finds three records at the oracle offsets', async () => {
    const t = table(await run(bytesOf(WARC), { format: 'records' }));
    expect(t.rows.map((r) => r[1])).toEqual(['74', '282', '554']);
    expect(t.rows.map((r) => r[2])).toEqual(['warcinfo', 'request', 'response']);
  });

  it('reports the archive version and record types', async () => {
    const m = kv(table(await run(bytesOf(WARC))));
    expect(m.get('WARC version')).toBe('1.0');
    expect(m.get('Records')).toBe('3');
    expect(m.get('Record types')).toBe('warcinfo 1, request 1, response 1');
  });

  it('reads the file header block fields', async () => {
    const m = kv(table(await run(bytesOf(WARC))));
    expect(m.get('Header: software-info')).toBe('test-writer/1.0');
    expect(m.get('Header: format')).toBe('WARC File Format 1.0');
  });

  it('reports a clean archive with no findings', async () => {
    const m = kv(table(await run(bytesOf(WARC))));
    expect(m.get('Findings')).toBe('0 error, 0 warning, 0 note');
  });

  it('records each record length from header plus content plus trailer', async () => {
    const t = table(await run(bytesOf(WARC), { format: 'records' }));
    const lengths = t.rows.map((r) => r[3]);
    // Header plus content plus 4-byte trailer, from the independent Python walk.
    expect(lengths[0]).toBe('208 B');
    expect(lengths[1]).toBe('272 B');
    expect(lengths[2]).toBe('332 B');
  });
});

describe('HTTP response records', () => {
  it('reads the embedded status line', async () => {
    const t = table(await run(bytesOf(WARC), { format: 'responses' }));
    expect(t.rows[0]?.[2]).toBe('200 OK');
    expect(t.rows[0]?.[3]).toBe('http://example.com/');
  });

  it('says so when there are no response records', async () => {
    const onlyInfo = FILE_HEADER + INFO;
    const t = table(await run(bytesOf(onlyInfo), { format: 'responses' }));
    expect(t.rows[0]?.[2]).toContain('No response records');
  });
});

describe('gzip archives', () => {
  it('decodes a gzip-compressed WARC', async () => {
    const gz = await gzip(bytesOf(WARC));
    const m = kv(table(await run(gz, { format: 'summary' })));
    expect(m.get('Compressed')).toBe('yes (gzip)');
    expect(m.get('Records')).toBe('3');
    expect(m.get('WARC version')).toBe('1.0');
  });

  it('finds the same record offsets after decompression', async () => {
    const gz = await gzip(bytesOf(WARC));
    const t = table(await run(gz, { format: 'records' }));
    expect(t.rows.map((r) => r[1])).toEqual(['74', '282', '554']);
  });
});

describe('damage detection', () => {
  it('flags a record whose Content-Length overruns the file', async () => {
    const bad = `${FILE_HEADER}WARC/1.0\r\nWARC-Type: resource\r\nContent-Length: 9999\r\n\r\n`;
    const t = table(await run(bytesOf(bad), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('truncated-record');
    expect(t.rows.some((r) => r[1] === 'ERROR')).toBe(true);
  });

  it('flags a missing or non-numeric Content-Length', async () => {
    const bad = `${FILE_HEADER}WARC/1.0\r\nWARC-Type: resource\r\nContent-Length: abc\r\n\r\n`;
    const t = table(await run(bytesOf(bad), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('bad-content-length');
  });

  it('flags a record with no header terminator', async () => {
    const bad = `${FILE_HEADER}WARC/1.0\r\nWARC-Type: resource\r\nContent-Length: 0\r\n`;
    const t = table(await run(bytesOf(bad), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('unterminated-header');
  });

  it('flags bytes that are not a record where one is expected', async () => {
    const bad = `${FILE_HEADER}GARBAGE NOT A RECORD\r\n\r\n`;
    const t = table(await run(bytesOf(bad), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('lost-sync');
  });

  it('warns when a record has no trailing CRLFCRLF', async () => {
    const rec = 'WARC/1.0\r\nWARC-Type: resource\r\nContent-Length: 2\r\n\r\nhi';
    const t = table(await run(bytesOf(FILE_HEADER + rec), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('missing-record-trailer');
  });

  it('warns about a response record with no HTTP status line', async () => {
    const rec = record(
      'response',
      { 'Target-URI': 'http://x/', 'Content-Type': 'application/http;msgtype=response' },
      'not an http message',
    );
    const t = table(await run(bytesOf(FILE_HEADER + rec), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('response-without-status');
  });
});

describe('block digest verification', () => {
  // Base32 SHA-1 values below come from Python: base64.b32encode(hashlib.sha1(body).digest()).
  async function archival(declared: string, body: string): Promise<Uint8Array> {
    const head =
      'WARC/1.0\r\nWARC-Type: resource\r\nWARC-Date: 2024-05-01T12:00:00Z\r\n' +
      `WARC-Block-Digest: ${declared}\r\nTarget-URI: http://a/\r\n` +
      `Content-Length: ${body.length}\r\n\r\n`;
    return bytesOf(FILE_HEADER + head + body + '\r\n\r\n');
  }

  const GOOD = `sha1:${'VVGDXUNVCNY62K5E6RUPJO42XFDPIUX3'}`;

  it('verifies a block digest that matches the content', async () => {
    const t = table(await run(await archival(GOOD, 'good body'), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).not.toContain('block-digest-mismatch');
    const m = kv(table(await run(await archival(GOOD, 'good body'))));
    expect(m.get('Block digests')).toBe('1 verified, 0 mismatch');
  });

  it('flags a block digest that does not match the content', async () => {
    const bad: string = GOOD;
    const t = table(await run(await archival(bad, 'tampered payload'), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('block-digest-mismatch');
    const m = kv(table(await run(await archival(bad, 'tampered payload'))));
    expect(m.get('Block digests')).toBe('1 verified, 1 mismatch');
  });

  it('says none declared when no digest header is present', async () => {
    const m = kv(table(await run(bytesOf(WARC))));
    expect(m.get('Block digests')).toBe('none declared');
  });

  it('reports an unsupported digest algorithm instead of guessing', async () => {
    const t = table(await run(await archival('md5:abc123', 'body'), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('block-digest-unchecked');
  });
});

describe('aggregation', () => {
  it('counts duplicate target URIs', async () => {
    const m = kv(table(await run(bytesOf(WARC))));
    expect(m.get('Duplicate URIs')).toBe('1');
    expect(m.get('Distinct target URIs')).toBe('1');
  });

  it('lists target URIs with their record counts', async () => {
    const t = table(await run(bytesOf(WARC), { format: 'uris' }));
    expect(t.headers).toEqual(['Target URI', 'Records', 'Duplicate']);
    expect(t.rows[0]).toEqual(['http://example.com/', '2', 'yes']);
  });

  it('notes that no warcinfo record is present', async () => {
    const onlyReq = FILE_HEADER + REQUEST;
    const t = table(await run(bytesOf(onlyReq), { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('no-warcinfo');
  });
});

describe('input guards', () => {
  it('rejects a file that does not start with a WARC version line', async () => {
    await expect(run(bytesOf('PK\x03\x04not a warc'))).rejects.toThrow(/not a WARC/u);
  });

  it('rejects a WARC whose first header block never terminates', async () => {
    await expect(run(bytesOf('WARC/1.0\r\nno terminator here'))).rejects.toThrow(
      /no complete header block/u,
    );
  });

  it('rejects a missing file', async () => {
    await expect(tool.run({ files: [], options: {} } as never)).rejects.toThrow(/No archive/u);
  });

  it('rejects an empty file', async () => {
    await expect(run(new Uint8Array(0))).rejects.toThrow(/empty/u);
  });

  it('rejects a file over the 64 MB cap', async () => {
    const huge = new File([new Uint8Array(65 * 1024 * 1024).buffer as ArrayBuffer], 'huge.warc');
    await expect(tool.run({ files: [huge], options: {} } as never)).rejects.toThrow(/64 MB/u);
  });

  it('clamps a negative row cap to zero rows', async () => {
    const t = table(await run(bytesOf(WARC), { format: 'records', maxRows: -5 }));
    expect(t.rows.length).toBe(0);
  });

  it('falls back to the summary for an unknown view', async () => {
    const r = await run(bytesOf(WARC), { format: 'nope' });
    expect(kv(table(r)).get('WARC version')).toBe('1.0');
    expect(r.warnings?.some((w) => w.includes('nope'))).toBe(true);
  });
});