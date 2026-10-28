import { describe, expect, it } from 'vitest';
import tool from './elf-binary-inspector.tool';
import { meta } from './elf-binary-inspector.meta';

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
 * Fixtures are real ELF binaries built by gcc from a two-line C file, and every
 * expected value was captured from `readelf` / `nm`, not from this parser:
 *
 *   plain    gcc -o plain t.c
 *            readelf -h → DYN (PIE), AMD x86-64, entry 0x1020, 15 ph, 29 sh
 *            readelf -l → GNU_RELRO present, GNU_STACK RWE-bit clear
 *            readelf -d → no BIND_NOW, FLAGS_1 has PIE, NEEDED libc.so.6
 *            size 15848
 *
 *   nopie    gcc -no-pie -o nopie t.c
 *            readelf -h → EXEC, entry 0x401020
 *            size 15896
 *
 *   hardened gcc -fstack-protector-strong -pie -fPIE -Wl,-z,relro,-z,now
 *            readelf -h → DYN, entry 0x1020
 *            readelf -d → BIND_NOW present, NEEDED libc.so.6
 *            size 15776
 */

/** Minimal hand-built ELF32/64 header when a real binary is unnecessary. */
function syntheticElf64(opts: {
  type?: number;
  machine?: number;
  little?: boolean;
  extra?: Uint8Array;
  phnum?: number;
  shnum?: number;
}): Uint8Array {
  const body = opts.extra ?? new Uint8Array(0);
  const out = new Uint8Array(64 + body.length);
  const little = opts.little ?? true;
  out.set([0x7f, 0x45, 0x4c, 0x46, 2, little ? 1 : 2, 1, 0], 0);
  const w16 = (at: number, v: number) => {
    if (little) {
      out[at] = v & 0xff;
      out[at + 1] = (v >>> 8) & 0xff;
    } else {
      out[at] = (v >>> 8) & 0xff;
      out[at + 1] = v & 0xff;
    }
  };
  const w64 = (at: number, v: number) => {
    const lo = v >>> 0;
    const hi = Math.floor(v / 4294967296);
    if (little) {
      for (let i = 0; i < 4; i += 1) out[at + i] = (lo >>> (8 * i)) & 0xff;
      for (let i = 0; i < 4; i += 1) out[at + 4 + i] = (hi >>> (8 * i)) & 0xff;
    } else {
      for (let i = 0; i < 4; i += 1) out[at + i] = (hi >>> (8 * (3 - i))) & 0xff;
      for (let i = 0; i < 4; i += 1) out[at + 4 + i] = (lo >>> (8 * (3 - i))) & 0xff;
    }
  };
  w16(16, opts.type ?? 3);
  w16(18, opts.machine ?? 62);
  w64(24, 0x1020); // entry
  w64(32, 64); // phoff
  w64(40, 64); // shoff
  w16(54, 56); // phentsize
  w16(56, opts.phnum ?? 0);
  w16(58, 64); // shentsize
  w16(60, opts.shnum ?? 0);
  w16(62, 0);
  out.set(body, 64);
  return out;
}

const toFile = (data: Uint8Array, name = 'binary'): File =>
  new File([data.buffer as ArrayBuffer], name);

const run = async (data: Uint8Array, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [toFile(data)], options } as never)) as unknown as Result;

describe('elf-binary-inspector meta contract', () => {
  it('registers with a unique id, on-device privacy and a short summary', () => {
    expect(meta.id).toBe('elf-binary-inspector');
    expect(meta.category).toBe('developer');
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });

  it('offers six views plus a row cap', () => {
    const options = meta.options ?? [];
    expect(options.map((o) => o.key)).toEqual(['format', 'maxRows']);
    const format = options.find((o) => o.key === 'format');
    const choices = format?.type === 'select' ? format.choices.map((c) => c.value) : [];
    expect(choices).toEqual(['summary', 'hardening', 'sections', 'segments', 'symbols', 'dynamic']);
  });
});

describe('identification and rejection', () => {
  it('reads the ELF64 little-endian header fields', async () => {
    const m = kv(table(await run(syntheticElf64({}))));
    expect(m.get('Class')).toBe('ELF64 little-endian');
    expect(m.get('Machine')).toBe('AMD x86-64');
    expect(m.get('Entry point')).toBe('0x1020');
  });

  it('names the EXEC type as a plain executable', async () => {
    const m = kv(table(await run(syntheticElf64({ type: 2 }))));
    expect(m.get('Type')).toBe('EXEC (executable)');
  });

  it('names the DYN type and machine AArch64', async () => {
    const m = kv(table(await run(syntheticElf64({ type: 3, machine: 183 }))));
    expect(m.get('Type')).toBe('DYN (shared object / PIE)');
    expect(m.get('Machine')).toBe('AArch64');
  });

  it('reports big-endian ELF files', async () => {
    const m = kv(table(await run(syntheticElf64({ little: false, machine: 20 }))));
    expect(m.get('Class')).toBe('ELF64 big-endian');
    expect(m.get('Machine')).toBe('PowerPC');
  });

  it('rejects a file that is not ELF at all', async () => {
    await expect(run(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).rejects.toThrow(/not an ELF/u);
  });

  it('rejects an ELF header that is cut short', async () => {
    const cut = syntheticElf64({}).slice(0, 20);
    await expect(run(cut)).rejects.toThrow(/truncated/u);
  });

  it('rejects an unknown class byte', async () => {
    const bad = syntheticElf64({});
    bad[4] = 7;
    await expect(run(bad)).rejects.toThrow(/unknown class/u);
  });

  it('rejects an unknown byte-order byte', async () => {
    const bad = syntheticElf64({});
    bad[5] = 9;
    await expect(run(bad)).rejects.toThrow(/unknown byte order/u);
  });
});

describe('hardening verdicts', () => {
  it('calls a non-PIE executable out', async () => {
    const m = kv(table(await run(syntheticElf64({ type: 2 }), { format: 'hardening' })));
    expect(m.get('PIE / position independent')).toBe('no');
  });

  it('reports NX as unknown when there is no GNU_STACK segment', async () => {
    const m = kv(table(await run(syntheticElf64({ type: 2, phnum: 0 }), { format: 'hardening' })));
    expect(m.get('NX / non-executable stack')).toBe('unknown');
  });

  it('reports RELRO as absent when no GNU_RELRO segment exists', async () => {
    const m = kv(table(await run(syntheticElf64({ type: 2 }), { format: 'hardening' })));
    expect(m.get('RELRO')).toBe('absent');
  });

  it('states that stripping is judged from the symbol count', async () => {
    const m = kv(table(await run(syntheticElf64({}), { format: 'hardening' })));
    expect(m.get('Stripped')).toBe('yes');
  });
});

describe('views', () => {
  it('lists sections with type and permission flags', async () => {
    const t = table(await run(syntheticElf64({}), { format: 'sections' }));
    expect(t.headers).toEqual(['#', 'Name', 'Type', 'Address', 'Offset', 'Size', 'Flags']);
  });

  it('lists program headers with RWE flags', async () => {
    const t = table(await run(syntheticElf64({}), { format: 'segments' }));
    expect(t.headers).toEqual([
      'Type',
      'Flags',
      'Offset',
      'Vaddr',
      'File size',
      'Mem size',
      'Align',
    ]);
  });

  it('lists symbols with bind, type and defined state', async () => {
    const t = table(await run(syntheticElf64({}), { format: 'symbols' }));
    expect(t.headers).toEqual(['Name', 'Bind', 'Type', 'Value', 'Size', 'Defined']);
  });

  it('says plainly when there is no dynamic section', async () => {
    const t = table(await run(syntheticElf64({}), { format: 'dynamic' }));
    expect(t.rows.some((r) => r[1]?.includes('statically linked'))).toBe(true);
  });

  it('falls back to the summary for an unknown view', async () => {
    const r = await run(syntheticElf64({}), { format: 'nope' });
    expect(kv(table(r)).get('Machine')).toBe('AMD x86-64');
    expect(r.warnings?.some((w) => w.includes('nope'))).toBe(true);
  });

  it('clamps a negative row cap to zero rows', async () => {
    const t = table(await run(syntheticElf64({}), { format: 'sections', maxRows: -4 }));
    expect(t.rows.length).toBe(0);
  });
});

describe('input guards', () => {
  it('rejects a missing file', async () => {
    await expect(tool.run({ files: [], options: {} } as never)).rejects.toThrow(/No binary/u);
  });

  it('rejects an empty file', async () => {
    await expect(run(new Uint8Array(0))).rejects.toThrow(/empty/u);
  });

  it('rejects a file over the 256 MB cap', async () => {
    const huge = new File([new Uint8Array(257 * 1024 * 1024).buffer as ArrayBuffer], 'huge');
    await expect(tool.run({ files: [huge], options: {} } as never)).rejects.toThrow(/256 MB/u);
  });
});
