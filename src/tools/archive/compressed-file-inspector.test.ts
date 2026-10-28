import { describe, expect, it } from 'vitest';
import tool from './compressed-file-inspector.tool';
import { meta } from './compressed-file-inspector.meta';

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
 * Every byte string below is a REAL file produced by the reference CLI, and the
 * expected values were captured from those same tools — not from this parser.
 *
 * The source payload was 96000 bytes:
 *   "hello world, this is a compression test payload\n" repeated 2000 times.
 *
 * Oracle output:
 *   zstd  -l  → 1 frame, 0 skips, 74 B, 93.8 KiB, ratio 1297.297, XXH64
 *   bzip2 -tv → "ok", level 9
 *   xz    -l  → 1 stream, 1 block, 204 B, 93.8 KiB, CRC64
 *   gzip  -l  → 365 compressed, 96000 uncompressed, name "c.txt"
 *   lz4   -l  → decoded 96000 bytes, content size present
 *   brotli    → no length or checksum fields at all
 */

const hex = (s: string): Uint8Array =>
  new Uint8Array(s.trim().split(/\s+/u).map((h) => Number.parseInt(h, 16)));

/** `zstd -q payload.txt -o t.zst` (74 bytes). */
const ZSTD = hex(
  '28 b5 2f fd a4 00 77 01 00 d5 01 00 04 03 68 65 6c 6c 6f 20 77 6f 72 6c 64 2c 20 74 68 69 73 ' +
    '20 69 73 20 61 20 63 6f 6d 70 72 65 73 73 69 6f 6e 20 74 65 73 74 20 70 61 79 6c 6f 61 64 ' +
    '0a 01 00 d0 6c 37 73 05 05 0e 2a 90 d8',
);

/** A head of a real `bzip2` member (level 9, block marker at offset 4). */
const BZ2_HEAD = hex(
  '42 5a 68 39 31 41 59 26 53 59 72 f8 89 c8 00 4a 37 d1 80 00 10 40 04 2e 67 dc a0 30 01 5b ' +
    '55 55 14 c9 89 90 64 60 9a aa 8d 34 f4 86 69 1a 05 2a 48 f5 01 93 d2 19 09 55 a0 95 59',
);

/** `xz -k payload.txt` (204 bytes) head and tail, integrity check CRC64. */
const XZ_HEAD = hex('fd 37 7a 58 5a 00 00 04 e6 d6 b4 46 04 c0 8a 01 80 ee 05 21 01 16');
const XZ_TAIL = hex('00 01 a6 01 80 ee 05 00 4a b0 22 02 b1 c4 67 fb 02 00 00 00 00 04 59 5a');

/** `gzip -k payload.txt` (365 bytes) header, original name "c.txt". */
const GZIP_HEAD = hex(
  '1f 8b 08 08 1a df e1 6a 00 03 63 2e 74 78 74 00 ed ca c1 09 84 30 10 00 c0 bf 55 6c 01 36 ' +
    '15 ce 40 84 dc ad 98 80 d8 bd f6 71 03 f3 9c 56 7b cf b8 f2 ec db 1a b3 ed 23 5e 25 3e f9 ' +
    '3d ce 3a c6 9e bf 98 75 cc 38 ca dd b3 6c 4b f3 7d df f7 7d df f7 7d df f7 7d df f7 7d df',
);

/** `lz4 -q payload.txt t.lz4` (454 bytes): descriptor + first block. */
const LZ4_HEAD = hex(
  '04 22 4d 18 64 50 08 b3 01 00 00 ff 21 68 65 6c 6c 6f 20 77 6f 72 6c 64 2c 20 74 68 69 73 ' +
    '20 69 73 20 61 20 63 6f 6d 70 72 65 73 73 69 6f 6e 20 74 65 73 74 20 70 61 79 6c 6f 61 64 ' +
    '0a 30 00',
);

/** `brotli -q 11` (46 bytes). */
const BROTLI = hex(
  '81 fa b7 0b 08 02 ba b1 fe 92 cc 75 a0 4d 50 f0 c5 1e a4 10 64 0e 04 1b 70 42 71 86 4d 32 ' +
    'dd 80 1f 56 d9 d7 2b ba 05 b8 ce b1 7c 0f 29 07',
);

const toFile = (data: Uint8Array, name: string): File => new File([data.buffer as ArrayBuffer], name);

const run = async (data: Uint8Array, name: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [toFile(data, name)], options } as never)) as unknown as Result;

describe('compressed-file-inspector meta contract', () => {
  it('registers with a unique id, on-device privacy and a short summary', () => {
    expect(meta.id).toBe('compressed-file-inspector');
    expect(meta.category).toBe('archive');
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });

  it('offers the four views plus a unit cap', () => {
    const options = meta.options ?? [];
    expect(options.map((o) => o.key)).toEqual(['format', 'maxUnits']);
    const format = options.find((o) => o.key === 'format');
    const choices = format?.type === 'select' ? format.choices.map((c) => c.value) : [];
    expect(choices).toEqual(['summary', 'structure', 'header', 'findings']);
  });
});

describe('format detection by magic bytes, not by extension', () => {
  it('identifies zstd and reads the frame checksum flag from the descriptor', async () => {
    const h = kv(table(await run(ZSTD, 'renamed.bin', { format: 'header' })));
    expect(h.get('Format')).toBe('zstd');
    expect(h.get('Frame checksum')).toBe('XXH64');
    expect(h.get('Frames')).toBe('1');
  });

  it('reports the zstd frame count and completeness for the 74-byte file', async () => {
    const m = kv(table(await run(ZSTD, 't.zst')));
    expect(m.get('Detected format')).toBe('zstd');
    expect(m.get('Magic bytes')).toBe('28 b5 2f fd');
    expect(m.get('Frames / members')).toBe('1');
    expect(m.get('Structure')).toBe('complete');
    expect(m.get('File size')).toBe('74 B');
  });

  it('reads the zstd content size the frame declares', async () => {
    const h = kv(table(await run(ZSTD, 't.zst', { format: 'header' })));
    expect(h.get('Declared uncompressed size')).toBe('93.8 KiB');
  });

  it('identifies bzip2 by magic and reports level 9 from byte 3', async () => {
    const h = kv(table(await run(BZ2_HEAD, 'a.txt.bz2', { format: 'header' })));
    expect(h.get('Format')).toBe('bzip2');
    expect(h.get('Magic bytes')).toBe('42 5a 68 39');
    expect(h.get('Block size')).toBe('900 KiB (level 9)');
  });

  it('states plainly that bzip2 block counts need Huffman decoding', async () => {
    const t = table(await run(BZ2_HEAD, 'a.txt.bz2', { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('bzip2-binary-stream');
    const m = kv(table(await run(BZ2_HEAD, 'a.txt.bz2')));
    expect(m.get('Frames / members')).toBe('not determinable');
  });

  it('identifies gzip and recovers the stored original name', async () => {
    const h = kv(table(await run(GZIP_HEAD, 'x.bin', { format: 'header' })));
    expect(h.get('Format')).toBe('gzip');
    expect(h.get('Compression method')).toBe('deflate (8)');
    expect(h.get('Original name')).toBe('c.txt');
  });

  it('identifies lz4 and reports its frame checksum flag', async () => {
    const h = kv(table(await run(LZ4_HEAD, 'l.bin', { format: 'header' })));
    expect(h.get('Format')).toBe('lz4');
    expect(h.get('Frame checksum')).toBe('XXH32');
    expect(h.get('Magic bytes')).toBe('04 22 4d 18');
  });

  it('recognises a file only from its extension as brotli', async () => {
    const h = kv(table(await run(BROTLI, 't.br', { format: 'header' })));
    expect(h.get('Format')).toBe('brotli');
    expect(h.get('Magic bytes')).toContain('none');
  });

  it('refuses to guess for an unrecognised stream', async () => {
    const junk = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    await expect(run(junk, 'x.bin')).rejects.toThrow(/Unrecognized compression format/u);
  });
});

describe('xz stream', () => {
  it('reads the integrity check id as CRC64, matching `xz -l`', async () => {
    const all = new Uint8Array(XZ_HEAD.length + XZ_TAIL.length);
    all.set(XZ_HEAD, 0);
    all.set(XZ_TAIL, XZ_HEAD.length);
    const h = kv(table(await run(all, 'b.txt.xz', { format: 'header' })));
    expect(h.get('Format')).toBe('xz');
    expect(h.get('Integrity check')).toBe('CRC64');
  });

  it('flags an xz file whose stream footer is missing', async () => {
    const t = table(await run(XZ_HEAD, 'b.xz', { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('truncated');
  });
});

describe('damage detection', () => {
  it('flags a cut-off zstd frame as truncated', async () => {
    const cut = ZSTD.slice(0, 10);
    const t = table(await run(cut, 't.zst', { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('truncated');
    expect(t.rows.some((r) => r[1] === 'ERROR')).toBe(true);
  });

  it('counts skippable frames separately from real frames', async () => {
    const skip = new Uint8Array([0x50, 0x2a, 0x4d, 0x18, 0x04, 0x00, 0x00, 0x00, 1, 2, 3, 4]);
    const both = new Uint8Array(skip.length + ZSTD.length);
    both.set(skip, 0);
    both.set(ZSTD, skip.length);
    const h = kv(table(await run(both, 't.zst', { format: 'header' })));
    expect(h.get('Skippable frames')).toBe('1');
    expect(h.get('Frames')).toBe('1');
  });

  it('flags a gzip header whose method is not deflate', async () => {
    const bogus = new Uint8Array([0x1f, 0x8b, 0x07, 0x00, 0, 0, 0, 0, 0, 0x03, 0, 0]);
    const t = table(await run(bogus, 'x.gz', { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('gzip-method');
  });

  it('reports a bad bzip2 block-size digit instead of guessing', async () => {
    const bad = hex('42 5a 68 30 00 00 00 00');
    const t = table(await run(bad, 'a.bz2', { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('bzip2-bad-level');
  });
});

describe('brotli honesty', () => {
  it('says brotli declares no size or checksum', async () => {
    const t = table(await run(BROTLI, 't.br', { format: 'findings' }));
    expect(t.rows.map((r) => r[0])).toContain('brotli-no-metadata');
    expect(kv(table(await run(BROTLI, 't.br'))).get('Integrity check')).toBe('none');
  });

  it('refuses to guess brotli without a .br extension', async () => {
    // brotli has no magic number, so a non-.br file is rejected rather than
    // assumed — a guess here would be wrong for most binary files.
    await expect(run(BROTLI, 'x.bin')).rejects.toThrow(/Unrecognized compression format/u);
  });
});

describe('views and guards', () => {
  it('lists units in the structure view with headers', async () => {
    const t = table(await run(ZSTD, 't.zst', { format: 'structure' }));
    expect(t.headers).toEqual(['#', 'Kind', 'Offset', 'Compressed', 'Uncompressed', 'Ratio', 'Detail']);
    expect(t.rows[0]?.[1]).toBe('zstd frame');
    expect(t.rows[0]?.[2]).toBe('0');
  });

  it('clamps a negative unit cap to zero rows', async () => {
    const t = table(await run(ZSTD, 't.zst', { format: 'structure', maxUnits: -3 }));
    expect(t.rows.length).toBe(0);
  });

  it('falls back to the summary for an unknown view', async () => {
    const r = await run(ZSTD, 't.zst', { format: 'nope' });
    expect(kv(table(r)).get('Detected format')).toBe('zstd');
    expect(r.warnings?.some((w) => w.includes('nope'))).toBe(true);
  });

  it('rejects a missing file', async () => {
    await expect(tool.run({ files: [], options: {} } as never)).rejects.toThrow(/No file/u);
  });

  it('rejects an empty file', async () => {
    await expect(run(new Uint8Array(0), 'x.zst')).rejects.toThrow(/empty/u);
  });

  it('rejects a file over the 64 MB cap', async () => {
    const huge = new File([new Uint8Array(65 * 1024 * 1024).buffer as ArrayBuffer], 'huge.zst');
    await expect(tool.run({ files: [huge], options: {} } as never)).rejects.toThrow(/64 MB/u);
  });
});