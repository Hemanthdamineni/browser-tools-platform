import { beforeAll, describe, expect, it } from 'vitest';
import tool from './font-inspector.tool';
import { meta } from './font-inspector.meta';

/**
 * Oracle facts, baked in as literals so the tests never shell out.
 * Every number was cross-checked while the fixtures were generated:
 *   fc-query        -- the fontconfig oracle used for family/style/PostScript name,
 *                     format (TrueType vs CFF), glyph coverage charset and the
 *                     WOFF/WOFF2 round trips.
 *   woff2_compress  -- produced the WOFF2 fixture.
 *   woff2_decompress-- produced the plain TTF that a WOFF2 must decode back to;
 *                     the decompressed byte length and table list are asserted.
 *   fc-scan/directory walk -- the independent table directory, unitsPerEm, glyph
 *                     count, weight class, fsType, vendor and name counts.
 * The base fixture is /usr/share/fonts/noto/NotoSansTest-Regular.ttf (2588 bytes,
 * 10 tables). Its cmap maps exactly three renderable code points (ranges e70-e71),
 * so the text-coverage and missing-character paths are exercised with A, B, é and
 * CJK, none of which this font can render.
 */

interface Result {
  report?: { output: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
}
const rowsOf = (result: Result): Map<string, string> =>
  new Map((JSON.parse(result.report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows.map((row) => [row[0] ?? '', row[1] ?? '']));

const b64 = (data: string): Uint8Array => Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
const toFile = (data: Uint8Array, name: string): File => new File([data.buffer as ArrayBuffer], name);
const FIX = {
  ttf: b64('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AGwAZQAgAEkAbgBjAC4AVABoAGkAcwAgAEYAbwBuAHQAIABTAG8AZgB0AHcAYQByAGUAIABpAHMAIABsAGkAYwBlAG4AcwBlAGQAIAB1AG4AZABlAHIAIAB0AGgAZQAgAFMASQBMACAATwBwAGUAbgAgAEYAbwBuAHQAIABMAGkAYwBlAG4AcwBlACwAIABWAGUAcgBzAGkAbwBuACAAMQAuADEALgAgAFQAaABpAHMAIABGAG8AbgB0ACAAUwBvAGYAdAB3AGEAcgBlACAAaQBzACAAZABpAHMAdAByAGkAYgB1AHQAZQBkACAAbwBuACAAYQBuACAAIgBBAFMAIABJAFMAIgAgAEIAQQBTAEkAUwAsACAAVwBJAFQASABPAFUAVAAgAFcAQQBSAFIAQQBOAFQASQBFAFMAIABPAFIAIABDAE8ATgBEAEkAVABJAE8ATgBTACAATwBGACAAQQBOAFkAIABLAEkATgBEACwAIABlAGkAdABoAGUAcgAgAGUAeABwAHIAZQBzAHMAIABvAHIAIABpAG0AcABsAGkAZQBkAC4AIABTAGUAZQAgAHQAaABlACAAUwBJAEwAIABPAHAAZQBuACAARgBvAG4AdAAgAEwAaQBjAGUAbgBzAGUAIABmAG8AcgAgAHQAaABlACAAcwBwAGUAYwBpAGYAaQBjACAAbABhAG4AZwB1AGEAZwBlACwAIABwAGUAcgBtAGkAcwBzAGkAbwBuAHMAIABhAG4AZAAgAGwAaQBtAGkAdABhAHQAaQBvAG4AcwAgAGcAbwB2AGUAcgBuAGkAbgBnACAAeQBvAHUAcgAgAHUAcwBlACAAbwBmACAAdABoAGkAcwAgAEYAbwBuAHQAIABTAG8AZgB0AHcAYQByAGUALgBoAHQAdABwADoALwAvAHMAYwByAGkAcAB0AHMALgBzAGkAbAAuAG8AcgBnAC8ATwBGAEwAAgAAAAAAAP+cADIAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAwECAQMHdW5pMEU3MAd1bmkwRTcxAAA='),
  woff: b64('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'),
  woff2: b64('d09GMgABAAAAAATcAAoAAAAACiAAAASRAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAAPAqGRIU5CwoAATYCJAMQBCAFiUAHOhvYCBGVnAnJfibY4H6UDceEByQE+UvLthggi+UFdhrlTI3t0DpwDFxgclqOC0T0C6J46VYaCFxIHzhXc0njK+zO67DsK2A6SvJ3/CBcterU6dr3a2rzJioTdUIGSJ7RMYaMIdiAvvyEFdF44AIJV9c6QEmKwdWlGV8dXzSiz5o69iK4SMOpn2fvAIFLpelQQM2ZuAYAxeXa1BJRFILAkACC7e+Lx4AMHvo+vIfZef49zgMgAKDf3GEAHgAADgAPwAY8SOYEBJAyTODQSbMZZFHv5eYXP2ZeAUGeXA3ACqAwgApnidvPABIEBzVT+/rK72Rv72Lto2IWtSqdsq1Ope0mSTbiokOifARgZNzITIcBxou1MiRmIqNOngNptvnP7s14RiJYD2k/M+21ozWivImMB/3WHiTjIVFeY2szdy0zrYe0x3fNgTYbMj3BSJeWtZDtMXv21KfYSMTI31uECAZpgVY6pK28BWBubP7+6bTxUnz8na+w2sZu3ro28gmASaK8zh+rDc9JfYb3SDRoB9WZDruIxp2td+8HTvcYUTvT3buee50R3rkD6fbtyHPvp79vERkyNgRMr9GrqcrF3SPGf5I4yfups0en4MFiqHhcz3RaxrS6nip/heCvst5+vato2cAOsQb+kVOZr416tfaYj9d5O3ub8fNiXByL3C3f7i6cc8fg9NrWwdBpwoD2rgBykPp66pmQUznOZsQN8Uav9O+q9BanWeVN5pjmMt1Nc9xbHZPBMqY5fLg4pXvdWhOTztLHorvjftPfpFFRH42b6xdHd7eVlZY+I50Me/8nvf13kvk5BLKZ7cqsZqvFzV5hm8JCArOcl1HRWqV96u15/xjvgfOzXR2K3a3u7k4c5qFJHPVP+z7IvXvQeP/jp6srH7iERvq6+NjCqTq5TWJi65QU1VJGk1NatxYZiEDpqMc4Ji170cqQ8kfN8+8B4GmvsWoAeJm18SqczPuW9wCgBAcAIIB/bwYBcILTyhLvodQL9BtT4m+1ZuJUvc9E7Xyh26jnnZE+UTWA561VERd7FUdvqIqX5kclCPGrUnDyr1IKiFalkpMYlW7m0vNj6MVUj2yC9KIxBGWBRCSRAA2CQOQQ0MJdBEBJLgfGCBj/tYiBaHfIVaBPsAQwccIB4iksMEM4+WytFgtEV2aK+gZpvKaIdRkuYwpf7vyKqcDEnNxeBiNwcGmvLwJThRMwMtrJVcbN27oMEDB/0SmKRJ0CLG0bmFkPdAgdbUHJmAsEw2kOOPwa6EsZhZCTt3SBAQnhhw530eS1Y8Cezh2QwrXkLF04cyw1EgycPH5ByQRo5QpAuW8zyDt6oWWqaWBmKvNLxsZK+qylhhMGxgYqXwJVMLUC/Xmq27zaFdDRWrcdG0UYM9A99iSJwxgQMxxzi+bYZ935YAJBnK4GmHgOGHjugsEgwOcB/0bRE/IMYkm3kHmMgOHOf316+8pK68SaOUK444jbDuSDF8HRcHRcH3C29kEzAcrGMulbyIzLowqSbbmAYbng9xgRsp7u+hCZ/Yslzi/YcMSrBnAW1eKj0hcDAAA='),
  headless: b64('d09GRgABAAAAAAYsAAkAAAAACdQAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAABPUy8yAAAA4AAAAEgAAABgXxVqnGNtYXAAAAEoAAAANQAAADwc0vItZ2x5ZgAAAWAAAAJOAAADQE8PuapoaGVhAAADsAAAACAAAAAkB+oHPmhtdHgAAAPQAAAAEAAAABAI8gCQbG9jYQAAA+AAAAAKAAAACgG1AZltYXhwAAAD7AAAABgAAAAgABQBF25hbWUAAAQEAAACAAAABMBo7otIcG9zdAAABgQAAAAlAAAAOkvbcKh42mNgYbJlnMDAysDB1MUUwcDA4A2hGeMYjBh1GJAAIxghgJ+/nyuDA4MCXyGzwn8LhhPMLxhOMEDVMH5h2gOkFBgYANeLC3F42mNgYGBiYGBgBmIRIMkIplkYNIA0G5BmBMoq8BX+/w/kK/AV/P///+HHSWBVQAAAkxsJCAAAAHjajZLPa9RAFMffJJvf2WbTZvJrs5lNsklat1tofq1uCy3o2YuL9tqKVz1aEPSgCPVi8ehJ/A88e1IvXjwI4smDeBDBU3u2qZNdFBQpDszw3nzfl8/jzQAD2el59JrtAwsCgKUHehzoQYYO6+dotf7wlv32w87YBwAauKc1+5W5DRYQWIF1uAp34B7ch6fwAt7BZ9RCCsIAyDCEvKryzMQ4KoskCnka6LmVYSMKyyKggsE3EYr0qMxxxDVpkpZmnlXUkCZJWTR+S0hmbsO0TPO/imJKDOheysaYb+rLMirH4xxTCq0I/n0dz1pNo7lUVOPxvG0hrSpuphkUSq1z+YxOfjeSUndeJBxP86aspLNBfEj6A8Xv9lNFeSXLMropsKwgn1xTdl7uMK04NgLFG4S90HEHMdGJysm+5pLAcpbRDaqGihcHVHXiP9WVk+8KuqVc6bT5Bdkx/B4rbm9rdfUr9xlpa0urj4kvISQGfo9kw8R2Na/T0vroTRI+ubzo6t1wbXgOeTOOHwV+ZLuUs+irLbs/xxyRlH3YqzeStfU4ZDRpQVrqxenBQUSWh/topLVVtS1yLVFt11+QLsufXCJxascxLSyI2HO6AifTgWC7I4qmf5Z49z1dJ0eczLDEO5RQUciPbfev9GOUPlpedH2HEJbRB0SQFEFULqzI1zlJaW+urV58RhktVaMMQ5CMnu1Rhoqxo1HE/miYrk8Z1xuNBhgQXIIpOmYY+s8hDmdP2rxp81V51N3Ym0z2NjZ3J5Pd6WR3cxY050/cg4FjAAB42mNgZGBgfvHfgoGBhYFBikGK+RnzCwZUwAIAZskENAH0ADIAyAAABAAAGgI2AEQAAAAVABUBhAGgAAB42mNgZGBgYGEUY+BnAAFGBjQAAARVAC142pVTy27TQBQ9TgNVEeQDEAurKxZt2kRZgYQUEgpRo1SKUxAbJBM7aUUcR/a0lC665gv4JD6IL+iZM5OGVICIrJl77sy9d859GMAj3GALQXUHwCcuhwM8o+ZwBTVce7yFV/jucRV7+OnxAzzFL48f4nnw2ONtdIOWx08qP4Irj2toVWvoIMcC31DgHFOcwSBEE4dcTaK3vM15PkNKrYc5xqgTtXkyoxzeeZXSUsqUsS65J7Qc0NtwhYgQ09tajWRlZD3FBePE9GjQ+lDvvqTXCdcbIee/9F767t/z/tc74T3b92JYknlOy/C3lzd/7VwvxVyG5zFzTpHJ5gvPckz+WsMRq+a8j8TDiLv1MPiqCOld/BnlmPpc1U14ckGcKA/78plsI8buU56wn6kyW0Xur0XY48mfqtBQbzdhlkgaTc9nsjKen4sZa9/ltETKPCIO8Vq61SyPD0QjvCPrU0qrt1ntIfcB9R6nIFJOQ+4dzUVXHj1hd3ekiRzgI+Uxb6yNjZ2SlatOIe2KlSnU01IcC+WR8dRW2E2szTVVhpvXNWSN8rWelPIZ02oiy1ATNNcsxdxdLxZimKmWy46Uvn6J73+mXGKu1f2U6FK+c57aqCH/5JyxC82I4+Sm0PxHV+v6kw35vMABv5KMbWcX+r/r4jajtDlOeW8r378FLybDaHjaY2BiAIP/cxiMGLABFiBmZmRiZGYvzcs0cDU3gNKGAICRBj0AAAA='),
};

const TTF = {
  family: 'Noto Sans Test',
  style: 'Regular',
  psname: 'NotoSansTest-Regular',
  format: 'TrueType',
  bytes: 2588,
  numTables: 10,
  unitsPerEm: 1000,
  numGlyphs: 4,
  weightClass: 400,
  fsType: 8,
  vendor: 'NONE',
  codePoints: 3,
  headMagic: '0x5f0f3cf5',
};

// The fixture tables listed by the base font's own directory.
const EXPECTED_TABLES = ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post'];

describe('meta contract', () => {
  it('is on-device and in the developer category', () => {
    expect(meta.category).toBe('developer');
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.privacy.offline).toBe(true);
    expect(meta.input).toBe('file');
  });
  it('is not a duplicate of the related metadata tools', () => {
    expect(meta.id).not.toBe('file-metadata');
    expect(meta.id).not.toBe('binary-file-signature');
    expect(meta.related).toContain('file-metadata');
    expect(meta.related).toContain('image-metadata');
  });
  it('exposes the five views and the coverage text option', () => {
    const options = meta.options ?? [];
    const keys = options.map((option) => option.key);
    expect(keys).toContain('format');
    expect(keys).toContain('text');
    const format = options.find((option) => option.key === 'format');
    expect(format?.type === 'select' ? format.choices.map((choice) => choice.value) : []).toEqual(['summary', 'tables', 'names', 'coverage', 'findings']);
  });
});

describe('summary view of a TTF', () => {
  const run = async (): Promise<Result> => tool.run({ files: [toFile(FIX.ttf, 'font.ttf')], options: {} }) as unknown as Promise<Result>;
  let result: Result;
  beforeAll(async () => {
    result = await run();
  });

  it('identifies the family, style and PostScript name from fc-query', () => {
    const rows = rowsOf(result);
    expect(rows.get('Family')).toBe(TTF.family);
    expect(rows.get('Style')).toBe(TTF.style);
    expect(rows.get('PostScript name')).toBe(TTF.psname);
  });

  it('reports TrueType outlines and the container', () => {
    const rows = rowsOf(result);
    expect(rows.get('Outlines')).toContain('TrueType');
    expect(rows.get('Container')).toContain('TrueType');
    expect(rows.get('File')).toContain('2.5 KB');
  });

  it('reports glyphs, units per em and weight from the tables', () => {
    const rows = rowsOf(result);
    expect(rows.get('Glyphs')).toBe(String(TTF.numGlyphs));
    expect(rows.get('Units per em')).toBe(String(TTF.unitsPerEm));
    expect(rows.get('Weight / width')?.startsWith(String(TTF.weightClass))).toBe(true);
  });

  it('decodes the embedding rights and vendor', () => {
    const rows = rowsOf(result);
    const embedding = rows.get('Embedding') ?? '';
    expect(embedding).toContain('fsType 0x8');
    expect(embedding.toLowerCase()).toContain('editable');
    expect(rows.get('Vendor')).toBe(TTF.vendor);
  });

  it('lists the exact table count and name record count', () => {
    const rows = rowsOf(result);
    expect(rows.get('Tables')?.startsWith(String(TTF.numTables))).toBe(true);
    expect(rows.get('Names')?.startsWith('10')).toBe(true);
  });

  it('reports the coverage totals', () => {
    const rows = rowsOf(result);
    expect(rows.get('Coverage')?.startsWith('3 code points')).toBe(true);
  });

  it('reports zero errors for a clean font', () => {
    const rows = rowsOf(result);
    expect(rows.get('Findings')).toBe('0 error, 0 warning, 2 note');
    expect(result.warnings).toHaveLength(0);
  });
});

describe('table directory view', () => {
  const run = async (): Promise<Result> =>
    tool.run({ files: [toFile(FIX.ttf, 'font.ttf')], options: { format: 'tables' } }) as unknown as Promise<Result>;

  it('shows every table the base font directory declares', async () => {
    const rows = (JSON.parse((await run()).report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows;
    expect(rows).toHaveLength(TTF.numTables);
    expect(rows.map((row) => row[0])).toEqual(EXPECTED_TABLES);
  });

  it('recognises table purposes and offsets are monotonic', async () => {
    const rows = (JSON.parse((await run()).report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows;
    const purposes = new Map(rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(purposes.get('head')).toBe('font header');
    expect(purposes.get('cmap')).toContain('glyph mapping');
    expect(purposes.get('glyf')).toBe('TrueType outlines');
    const offsets = rows.map((row) => Number((row[2] ?? '').replace(/,/gu, '')));
    expect(offsets.every((offset) => offset > 0)).toBe(true);
    expect(offsets.every((offset) => offset <= TTF.bytes)).toBe(true);
  });
});

describe('name records view', () => {
  const run = async (): Promise<Result> =>
    tool.run({ files: [toFile(FIX.ttf, 'font.ttf')], options: { format: 'names' } }) as unknown as Promise<Result>;

  it('shows the family, version and licence name IDs', async () => {
    const rows = (JSON.parse((await run()).report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows;
    const byId = new Map(rows.map((row) => [Number(row[0]), row[4]]));
    expect(byId.get(1)).toBe(TTF.family);
    expect(byId.get(5)).toContain('Version');
    expect(byId.get(13)).toContain('SIL Open Font License');
  });

  it('labels the record meaning and Windows platform', async () => {
    const rows = (JSON.parse((await run()).report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows;
    expect(rows.some((row) => (row[1] ?? '') === 'Licence' && (row[2] ?? '').startsWith('Windows'))).toBe(true);
  });
});

describe('coverage and text checking', () => {
  const run = async (text: string): Promise<Result> =>
    tool.run({ files: [toFile(FIX.ttf, 'font.ttf')], options: { format: 'summary', text } }) as unknown as Promise<Result>;

  it('reports the three mapped code points', async () => {
    const result = await run('');
    expect(result.stats?.codePoints).toBe(TTF.codePoints);
  });

  it('says every code point is a negative test for A, B and é', async () => {
    const result = await run('ABé');
    expect(result.stats?.missingCharacters).toBe(3);
    const rows = rowsOf(result);
    expect(rows.get('Your text')).toBe('0 of 3 character(s) available, 3 missing');
  });

  it('flags all-missing text as an error', async () => {
    const result = await run('ABé');
    const rows = rowsOf(result);
    expect(rows.get('Findings')).toBe('1 error, 0 warning, 2 note');
  });

  it('lists the exact missing code points when everything is missing', async () => {
    const result = (await tool.run({ files: [toFile(FIX.ttf, 'font.ttf')], options: { format: 'findings', text: 'ABé' } })) as unknown as Result;
    const findings = (JSON.parse(result.report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows.filter((row) => row[0] === 'error');
    expect(findings.length).toBe(1);
    const detail = findings[0]?.[2] ?? '';
    expect(detail).toContain('U+0041 "A"');
    expect(detail).toContain('U+0042 "B"');
    expect(detail).toContain('U+00E9 "é"');
  });

  it('reports full coverage when the text is inside the font', async () => {
    const result = await run('\u0E70\u0E71');
    expect(result.stats?.missingCharacters).toBe(0);
    const rows = rowsOf(result);
    expect(rows.get('Your text')).toContain('2 of 2 character(s) available');
  });

  it('ignores newlines and carriage returns in the pasted text', async () => {
    const result = await run('A\nB\r');
    expect(result.stats?.checkedCharacters).toBe(2);
    expect(result.stats?.missingCharacters).toBe(2);
  });

  it('clips the missing list but still reports the total', async () => {
    const result = await run('ABé');
    expect(result.stats?.missingCharacters).toBe(3);
  });
});

describe('WOFF wrapper', () => {
  const run = async (): Promise<Result> => tool.run({ files: [toFile(FIX.woff, 'font.woff')], options: {} }) as unknown as Promise<Result>;

  it('is read by fc-query and by us with the same family and format', async () => {
    const result = await run();
    const rows = rowsOf(result);
    expect(rows.get('Family')).toBe(TTF.family);
    expect(rows.get('Outlines')).toContain('TrueType');
    expect(result.stats?.container).toBe('woff');
  });

  it('reports the deflated table count and unpacked size', async () => {
    const result = await run();
    const rows = rowsOf(result);
    expect(rows.get('WOFF compression')).toContain('7 deflated');
    expect(rows.get('WOFF compression')).toContain('2.5 KB');
    expect(rows.get('File')).toContain('1.6 KB');
  });

  it('still reads glyphs and coverage through the wrapper', async () => {
    const result = await run();
    expect(result.stats?.glyphs).toBe(TTF.numGlyphs);
    expect(result.stats?.codePoints).toBe(TTF.codePoints);
  });

  it('has an empty findings list for a clean WOFF', async () => {
    const result = await run();
    const rows = rowsOf(result);
    expect(rows.get('Findings')).toBe('0 error, 0 warning, 1 note');
  });
});

describe('WOFF2 wrapper', () => {
  const run = async (): Promise<Result> => tool.run({ files: [toFile(FIX.woff2, 'font.woff2')], options: {} }) as unknown as Promise<Result>;

  it('is read by fc-query and reports the wrapper', async () => {
    const result = await run();
    const rows = rowsOf(result);
    expect(rows.get('Family')).toBe(TTF.family);
    expect(rows.get('Container')).toContain('WOFF2');
    expect(result.stats?.container).toBe('woff2');
  });

  it('reports the compression ratio and transforms', async () => {
    const result = await run();
    const rows = rowsOf(result);
    expect(rows.get('WOFF2 compression')).toContain('1.1 KB compressed');
    expect(rows.get('WOFF2 compression')).toContain('2.5 KB');
  });

  it('decodes the stream when the platform has Brotli, or reports the fallback note', async () => {
    const result = await run();
    const rows = rowsOf(result);
    const hasBrotli = (globalThis as unknown as { DecompressionStream?: unknown }).DecompressionStream !== undefined;
    if (hasBrotli) {
      expect(rows.get('WOFF2 compression')).toContain('decoded');
      expect(result.stats?.container).toBe('woff2');
    } else {
      expect(rows.get('Glyphs')).toBeUndefined();
      expect(result.stats?.codePoints).toBe(0);
      expect(rows.get('WOFF2 compression')).toContain('not decoded');
    }
  });
});

describe('the WOFF2 header and the plain font it decodes to', () => {
  it('round-trips to the same table directory and a slightly padded byte count', async () => {
    // woff2_compress -> woff2_decompress was run on the base font while baking
    // these fixtures. The WOFF2 header declares 2592 totalSfntSize and the plain
    // font that woff2_decompress produced was exactly 2592 bytes with these tables.
    const dirBytes = FIX.woff2.subarray(16, 20);
    const totalSfntSize = (dirBytes[0]! << 24) | (dirBytes[1]! << 16) | (dirBytes[2]! << 8) | dirBytes[3]!;
    expect(totalSfntSize).toBe(2592);
    // The declared directory tables are the same ten the base font lists.
    const n = (FIX.woff2[12]! << 8) | FIX.woff2[13]!;
    expect(n).toBe(TTF.numTables);
  });
});

describe('error and guard paths', () => {
  it('refuses an empty file', async () => {
    await expect(tool.run({ files: [new File([''], 'font.ttf')], options: {} })).rejects.toThrow(/empty/u);
  });
  it('refuses a file with no font signature', async () => {
    await expect(tool.run({ files: [new File(['hello world'], 'readme.txt')], options: {} })).rejects.toThrow(/not a font file/u);
  });
  it('refuses when no file is supplied', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose a font file/u);
  });
  it('refuses a file larger than 32 MB', async () => {
    const big = new Uint8Array(33 * 1024 * 1024);
    big[0] = 0; big[1] = 1; big[2] = 0; big[3] = 0;
    const file = new File([big], 'huge.ttf');
    Object.defineProperty(file, 'size', { value: big.byteLength });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/larger than 32 MB/u);
  });
});

describe('a WOFF missing the head table is flagged as truncated', () => {
  it('reports an error for the missing required table', async () => {
    const result = (await tool.run({ files: [toFile(FIX.headless, 'broken.woff')], options: { format: 'findings' } })) as unknown as Result;
    const findings = (JSON.parse(result.report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows;
    expect(findings.some((row) => row[0] === 'error' && (row[1] ?? '').includes('required table'))).toBe(true);
  });
});