import { describe, expect, it } from 'vitest';
import tool from './crc-calculator.tool';
import { meta } from './crc-calculator.meta';

type Result = {
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
};
type Table = { headers: string[]; rows: string[][] };

const table = (r: Result): Table => JSON.parse(r.report?.output ?? '') as Table;
const kv = (t: Table): Map<string, string> => new Map(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));

/**
 * The expected values below are the CRC catalogue's published check values for
 * the ASCII string "123456789", and the 256-byte binary-file values were
 * produced by an independent Python implementation of the same parameters.
 * They are baked as literals; nothing here recomputes a CRC to check a CRC.
 *
 *   "123456789"                      bytes(range(256))
 *   CRC-8/ATM            F4                    14
 *   CRC-8/MAXIM          A1                    18
 *   CRC-16/IBM           BB3D                  BAD3
 *   CRC-16/CCITT-FALSE   29B1                  3FBD
 *   CRC-16/MODBUS        4B37                  DE6C
 *   CRC-16/USB           B4C8                  2193
 *   CRC-16/XMODEM        31C3                  7E55
 *   CRC-32/ISO-HDLC      CBF43926              29058C73
 *   CRC-32C/Castagnoli   E3069283              9C44184B
 *   CRC-32/BZIP2         FC891918              B6B5EE95
 *   CRC-32/MPEG-2        0376E6E7              494A116A
 *   CRC-64/XZ            995DC9BBDF1939FA      72414B2F65DB3AB0
 *   CRC-64/ECMA-182      6C40DF5F0B497347      62B0DA1C1B130A91
 */

const CHECK_TEXT = '123456789';

const toFile = (data: Uint8Array, name = 'f.bin'): File =>
  new File([data.buffer as ArrayBuffer], name);

const run = async (
  files: File[],
  options: Record<string, string | number | boolean> = {},
  text?: string,
) => (await tool.run({ files, options, text } as never)) as unknown as Result;

const crcOf = async (opts: Record<string, string | number | boolean>, data?: Uint8Array) => {
  const files = data !== undefined ? [toFile(data)] : [];
  const m = kv(table(await run(files, opts, data === undefined ? CHECK_TEXT : undefined)));
  return m.get('Result (hex)');
};

describe('crc-calculator meta contract', () => {
  it('registers with a unique id, on-device privacy and a short summary', () => {
    expect(meta.id).toBe('crc-calculator');
    expect(meta.category).toBe('crypto');
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });

  it('accepts both files and pasted text', () => {
    expect(meta.input).toBe('file');
    expect(meta.acceptsText).toBe(true);
  });

  it('offers a preset list covering several widths', () => {
    const preset = (meta.options ?? []).find((o) => o.key === 'preset');
    const choices = preset?.type === 'select' ? preset.choices.map((c) => c.value) : [];
    expect(choices).toContain('crc-32-iso-hdlc');
    expect(choices).toContain('crc-64-xz');
    expect(choices).toContain('custom');
    expect(choices.length).toBeGreaterThanOrEqual(12);
  });
});

describe('catalogue check values over "123456789"', () => {
  const CASES: [string, string][] = [
    ['crc-8-atm', 'F4'],
    ['crc-8-maxim', 'A1'],
    ['crc-16-ibm', 'BB3D'],
    ['crc-16-ccitt-false', '29B1'],
    ['crc-16-modbus', '4B37'],
    ['crc-16-usb', 'B4C8'],
    ['crc-16-xmodem', '31C3'],
    ['crc-32-iso-hdlc', 'CBF43926'],
    ['crc-32c-castagnoli', 'E3069283'],
    ['crc-32-bzip2', 'FC891918'],
    ['crc-32-mpeg2', '0376E6E7'],
    ['crc-64-xz', '995DC9BBDF1939FA'],
    ['crc-64-ecma182', '6C40DF5F0B497347'],
  ];

  for (const [preset, expected] of CASES) {
    it(`computes ${preset} as ${expected}`, async () => {
      expect(await crcOf({ preset })).toBe(expected);
    });
  }
});

describe('binary file input', () => {
  const BIN = new Uint8Array(256).map((_, i) => i);

  const CASES: [string, string][] = [
    ['crc-8-atm', '14'],
    ['crc-8-maxim', '18'],
    ['crc-16-ibm', 'BAD3'],
    ['crc-16-ccitt-false', '3FBD'],
    ['crc-16-modbus', 'DE6C'],
    ['crc-16-usb', '2193'],
    ['crc-16-xmodem', '7E55'],
    ['crc-32-iso-hdlc', '29058C73'],
    ['crc-32c-castagnoli', '9C44184B'],
    ['crc-32-bzip2', 'B6B5EE95'],
    ['crc-32-mpeg2', '494A116A'],
    ['crc-64-xz', '72414B2F65DB3AB0'],
    ['crc-64-ecma182', '62B0DA1C1B130A91'],
  ];

  for (const [preset, expected] of CASES) {
    it(`computes ${preset} over bytes 0..255 as ${expected}`, async () => {
      expect(await crcOf({ preset }, BIN)).toBe(expected);
    });
  }

  it('reports the input name and length', async () => {
    const m = kv(table(await run([toFile(BIN, 'sample.bin')], { preset: 'crc-32-iso-hdlc' })));
    expect(m.get('Input')).toBe('sample.bin');
    expect(m.get('Length')).toBe('256 byte(s)');
  });
});

describe('custom parameters reproduce named presets', () => {
  it('builds CRC-16/MODBUS from raw parameters', async () => {
    const value = await crcOf({
      preset: 'custom',
      width: 16,
      poly: '8005',
      init: 'FFFF',
      refin: 'yes',
      refout: 'yes',
      xorout: '0000',
    });
    expect(value).toBe('4B37');
  });

  it('builds CRC-32/ISO-HDLC from raw parameters', async () => {
    const value = await crcOf({
      preset: 'custom',
      width: 32,
      poly: '04C11DB7',
      init: 'FFFFFFFF',
      refin: 'yes',
      refout: 'yes',
      xorout: 'FFFFFFFF',
    });
    expect(value).toBe('CBF43926');
  });

  it('accepts a 0x prefix and mixed case in hex fields', async () => {
    const value = await crcOf({
      preset: 'custom',
      width: 16,
      poly: '0x1021',
      init: '0xffff',
      refin: 'no',
      refout: 'no',
      xorout: '0x0000',
    });
    expect(value).toBe('29B1');
  });

  it('supports a 1-bit custom width', async () => {
    const m = kv(
      table(
        await run(
          [],
          {
            preset: 'custom',
            width: 1,
            poly: '1',
            init: '0',
            refin: 'no',
            refout: 'no',
            xorout: '0',
          },
          CHECK_TEXT,
        ),
      ),
    );
    expect(m.get('Width')).toBe('1 bits');
    expect(['0', '1']).toContain(m.get('Result (hex)'));
  });
});

describe('output formatting', () => {
  it('pads hex to the width in digits', async () => {
    const m = kv(table(await run([], { preset: 'crc-8-atm' }, CHECK_TEXT)));
    expect(m.get('Result (hex)')).toBe('F4');
  });

  it('pads a 64-bit result to 16 digits', async () => {
    const m = kv(table(await run([], { preset: 'crc-64-xz' }, CHECK_TEXT)));
    expect(m.get('Result (hex)')).toMatch(/^[0-9A-F]{16}$/u);
  });

  it('honours lowercase output', async () => {
    const m = kv(table(await run([], { preset: 'crc-32-iso-hdlc', uppercase: 'no' }, CHECK_TEXT)));
    expect(m.get('Result (hex)')).toBe('cbf43926');
  });

  it('reports decimal when asked', async () => {
    const m = kv(
      table(await run([], { preset: 'crc-32-iso-hdlc', output: 'decimal' }, CHECK_TEXT)),
    );
    expect(m.get('Result (decimal)')).toBe(String(0xcbf43926));
  });

  it('shows the parameters actually used', async () => {
    const m = kv(table(await run([], { preset: 'crc-16-modbus' }, CHECK_TEXT)));
    expect(m.get('CRC')).toBe('CRC-16/MODBUS');
    expect(m.get('Polynomial')).toBe('0x8005');
    expect(m.get('Initial value')).toBe('0xFFFF');
    expect(m.get('Reflect input')).toBe('yes');
    expect(m.get('Reflect output')).toBe('yes');
    expect(m.get('Final XOR')).toBe('0x0000');
  });
});

describe('input validation', () => {
  it('rejects an empty input', async () => {
    await expect(tool.run({ files: [], options: {} } as never)).rejects.toThrow(
      /Nothing to checksum/u,
    );
  });

  it('rejects a non-hexadecimal polynomial', async () => {
    await expect(
      run([], { preset: 'custom', width: 16, poly: 'zz', init: '0', xorout: '0' }, CHECK_TEXT),
    ).rejects.toThrow(/not hexadecimal/u);
  });

  it('rejects a polynomial that does not fit the width', async () => {
    await expect(
      run([], { preset: 'custom', width: 8, poly: '1FF', init: '0', xorout: '0' }, CHECK_TEXT),
    ).rejects.toThrow(/does not fit in 8 bits/u);
  });

  it('rejects an out-of-range width', async () => {
    await expect(
      run([], { preset: 'custom', width: 65, poly: '1', init: '0', xorout: '0' }, CHECK_TEXT),
    ).rejects.toThrow(/out of range/u);
  });

  it('rejects a file over the 128 MB cap', async () => {
    const huge = new File([new Uint8Array(129 * 1024 * 1024).buffer as ArrayBuffer], 'huge.bin');
    await expect(tool.run({ files: [huge], options: {} } as never)).rejects.toThrow(/128 MB/u);
  });
});
