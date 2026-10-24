import { describe, expect, it } from 'vitest';
import tool from './plist-decoder.tool';

type Result = {
  outputs: unknown[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

// Fixtures are written by Python's plistlib (3.14) and, for the damaged cases, by a
// hand-written byte builder. Expected values come from plistlib.load and from reading
// the trailer directly, so they are an independent oracle rather than this tool's output.
const RICH_BINARY = "YnBsaXN0MDDfEA8BAgMEBQYHCAkKCwwNDg8QERITFBUWFxgfICEiIyRTQmlnVEJsb2JVQ291bnRYRGlzYWJsZWRaRW1wdHlBcnJheVlFbXB0eURpY3RXRW5hYmxlZFRIdWdlVUl0ZW1zVExvbmdUTmFtZVhOZWdhdGl2ZVVSYXRpb1dVbmljb2RlVFdoZW4S/////0QAAQL/ECoIoNAJEwAgAAAAAAABpBkaGxwQAVN0d28jQAgAAAAAAADRHR5WbmVzdGVkU3llc18RASx4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHhmAEMAYQBmAOkAICYVE//////////5I0AMAAAAAAAAZ2XlZyyKnjDGMK0wuTDIM0HCOLN4AAAAAAgAKQAtADIAOABBAEwAVgBeAGMAaQBuAHMAfACCAIoAjwCUAJkAmwCcAJ0AngCfAKgArQCvALMAvAC/AMYAygH6AgcCEAIZAigAAAAAAAACAQAAAAAAAAAlAAAAAAAAAAAAAAAAAAACMQ==";
const RICH_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n<dict>\n\t<key>Big</key>\n\t<integer>4294967295</integer>\n\t<key>Blob</key>\n\t<data>\n\tAAEC/w==\n\t</data>\n\t<key>Count</key>\n\t<integer>42</integer>\n\t<key>Disabled</key>\n\t<false/>\n\t<key>EmptyArray</key>\n\t<array/>\n\t<key>EmptyDict</key>\n\t<dict/>\n\t<key>Enabled</key>\n\t<true/>\n\t<key>Huge</key>\n\t<integer>9007199254740993</integer>\n\t<key>Items</key>\n\t<array>\n\t\t<integer>1</integer>\n\t\t<string>two</string>\n\t\t<real>3.0</real>\n\t\t<dict>\n\t\t\t<key>nested</key>\n\t\t\t<string>yes</string>\n\t\t</dict>\n\t</array>\n\t<key>Long</key>\n\t<string>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</string>\n\t<key>Name</key>\n\t<string>Caf\u00e9 \u2615</string>\n\t<key>Negative</key>\n\t<integer>-7</integer>\n\t<key>Ratio</key>\n\t<real>3.5</real>\n\t<key>Unicode</key>\n\t<string>\u65e5\u672c\u8a9e\u30c6\u30ad\u30b9\u30c8</string>\n\t<key>When</key>\n\t<date>2020-05-17T12:34:56Z</date>\n</dict>\n</plist>\n";
const DEEP_BINARY = "YnBsaXN0MDDRAQJRa9EBA9EBBNEBBdEBBtEBB9EBCNEBCdEBCtEBC9EBDNEBDdEBDtEBD9EBENEBEdEBEtEBE9EBFNEBFdEBFtEBF9EBGNEBGdEBGtEBG9EBHNEBHdEBHtEBH9EBINEBIdEBItEBI9EBJNEBJdEBJtEBJ9EBKNEBKdEBKtEBK9EBLNEBLdEBLtEBL9EBMNEBMdEBMtEBM9EBNNEBNdEBNtEBN9EBONEBOdEBOtEBO9EBPNEBPdEBPtEBP9EBQNEBQdEBQtEBQ9EBRNEBRdEBRtEBR9EBSNEBSdEBStEBS9EBTNEBTdEBTtEBT9EBUNEBUdAICw0QExYZHB8iJSgrLjE0Nzo9QENGSUxPUlVYW15hZGdqbXBzdnl8f4KFiIuOkZSXmp2go6aprK+ytbi7vsHEx8rN0NPW2dzf4uXo6+7x9Pf6AAAAAAAAAQEAAAAAAAAAUgAAAAAAAAAAAAAAAAAAAPs=";
const UID_BINARY = "YnBsaXN0MDDRAQJTUmVmgAcICw8AAAAAAAABAQAAAAAAAAADAAAAAAAAAAAAAAAAAAAAEQ==";
const UNREACHABLE = "YnBsaXN0MDBRYVFiCAoAAAAAAAABAQAAAAAAAAACAAAAAAAAAAAAAAAAAAAADA==";
const TRAILING = "YnBsaXN0MDBRYQgAAAAAAAAAAAAAAQEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAo=";
const DUPLICATE = "YnBsaXN0MDBRaxABEALSAAABAggKDA4AAAAAAAABAQAAAAAAAAAEAAAAAAAAAAMAAAAAAAAAEw==";
const CYCLIC = "YnBsaXN0MDChAAgAAAAAAAABAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAACg==";
const BLOWUP = "YnBsaXN0MDCiAQGiAgKiAwOiBASiBQWiBgaiBweiCAiiCQmiCgqiCwuiDAyiDQ2iDg6iDw+iEBCiERGiEhKiExOiFBSiFRWiFhaiFxeiGBiiGRmiGhqiGxuiHByiHR2iHh6iHx8QAQgLDhEUFxodICMmKSwvMjU4Oz5BREdKTVBTVllcX2JlAAAAAAAAAQEAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAGc=";
const BADMAGIC = "YnBsaXN0OTlRYVFiCAoAAAAAAAABAQAAAAAAAAACAAAAAAAAAAAAAAAAAAAADA==";
const EXPECTED_SCALARS = {"Big": "4294967295", "Blob": "4 bytes", "Count": "42", "Disabled": "false", "Enabled": "true", "Huge": "9007199254740993", "Name": "Café ☕", "Negative": "-7", "Ratio": "3.5", "Unicode": "日本語テキスト", "When": "2020-05-17T12:34:56.000Z"} as Record<string, string>;
const EXPECTED_OBJECTS = 37 as number;

const fromBase64 = (base64: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const runBinary = async (base64: string, options: Record<string, string | number | boolean> = {}, name = 'sample.plist') =>
  (await tool.run({
    files: [new File([fromBase64(base64)], name, { type: 'application/x-plist' })],
    options,
  })) as Result;

const runText = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [], text, options })) as Result;

const table = (result: Result): Table => JSON.parse(result.report?.output ?? '{}') as Table;

const view = async (base64: string, format: string, options: Record<string, string | number | boolean> = {}) =>
  table(await runBinary(base64, { ...options, format }));

const viewText = async (text: string, format: string, options: Record<string, string | number | boolean> = {}) =>
  table(await runText(text, { ...options, format }));

const treeMap = (rows: string[][]): Map<string, string> => new Map(rows.map((row) => [row[0] ?? '', row[2] ?? '']));

const problems = (rows: string[][]): string[] => rows.map((row) => row[1] ?? '');

describe('plist-decoder', () => {
  it('decodes every scalar of a binary plist exactly as plistlib does', async () => {
    const map = treeMap((await view(RICH_BINARY, 'tree')).rows);
    expect(Object.keys(EXPECTED_SCALARS).length).toBeGreaterThan(6);
    for (const [key, expected] of Object.entries(EXPECTED_SCALARS)) {
      expect([key, map.get('root.' + key)]).toEqual([key, expected]);
    }
  });

  it('renders containers, data and empty collections', async () => {
    const map = treeMap((await view(RICH_BINARY, 'tree')).rows);
    expect(map.get('root.Blob')).toBe('4 bytes');
    expect(map.get('root.Items')).toBe('[4 items]');
    expect(map.get('root.Items[0]')).toBe('1');
    expect(map.get('root.Items[1]')).toBe('two');
    expect(map.get('root.Items[3]')).toBe('{1 key}');
    expect(map.get('root.Items[3].nested')).toBe('yes');
    expect(map.get('root.EmptyDict')).toBe('{0 keys}');
    expect(map.get('root.EmptyArray')).toBe('[0 items]');
  });

  it('decodes a binary plist and its XML twin to the same tree', async () => {
    const binary = (await view(RICH_BINARY, 'tree')).rows.map((row) => [row[0] ?? '', row[2] ?? '']);
    const xml = table(await runText(RICH_XML, { format: 'tree' })).rows.map((row) => [row[0] ?? '', row[2] ?? '']);
    expect(xml.length).toBeGreaterThan(10);
    expect(xml).toEqual(binary);
  });

  it('keeps the types it found', async () => {
    const rows = (await view(RICH_BINARY, 'tree')).rows;
    const types = new Map(rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(types.get('root.Name')).toMatch(/^string/u);
    expect(types.get('root.Name')).toBe('string (UTF-16)'); // plistlib stores non-ASCII as UTF-16
    expect(types.get('root.Enabled')).toBe('boolean');
    expect(types.get('root.Count')).toBe('integer (1 bytes)');
    expect(types.get('root.Ratio')).toBe('real (8 bytes)');
    expect(types.get('root.When')).toBe('date');
    expect(types.get('root.Blob')).toBe('data');
    expect(types.get('root.Long')).toBe('string');
  });

  it('keeps a 64-bit integer exact instead of rounding it', async () => {
    const result = await runBinary(RICH_BINARY, { format: 'findings' });
    expect(treeMap((await view(RICH_BINARY, 'tree')).rows).get('root.Huge')).toBe('9007199254740993');
    expect(problems(table(result).rows)).toContain('Integer needs more than 53 bits');
  });

  it('summarizes the binary structure using the trailer', async () => {
    const map = new Map((await view(RICH_BINARY, 'summary')).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(map.get('Format')).toBe('binary property list (bplist00)');
    expect(map.get('Top-level type')).toBe('dictionary');
    expect(map.get('Objects in offset table')).toBe(String(EXPECTED_OBJECTS));
    expect(map.get('Object ref size')).toBe('1 bytes');
    expect(map.get('Source')).toBe('sample.plist');
    expect(Number(map.get('Errors'))).toBe(0);
  });

  it('lists the raw object table of a binary plist', async () => {
    const rows = (await view(RICH_BINARY, 'objects')).rows;
    expect(rows.length).toBe(EXPECTED_OBJECTS);
    expect(rows[0]?.[0]).toBe('0');
    expect(rows[0]?.[1]).toMatch(/^0x[0-9A-F]{2}$/u);
    const kinds = new Set(rows.map((row) => row[2] ?? ''));
    expect(kinds.has('dictionary')).toBe(true);
    expect(kinds.has('string')).toBe(true);
    expect(kinds.has('integer')).toBe(true);
  });

  it('says the object table does not exist for XML', async () => {
    const rows = table(await runText(RICH_XML, { format: 'objects' })).rows;
    expect(rows).toEqual([
      ['-', '-', 'not applicable', '-', 'The offset table is part of the binary format; this is an XML plist.'],
    ]);
  });

  it('can show data blobs as base64', async () => {
    const map = treeMap((await view(RICH_BINARY, 'tree', { dataPreview: true })).rows);
    expect(map.get('root.Blob')).toBe('4 bytes: AAEC/w==');
  });

  it('warns about nesting deeper than the limit', async () => {
    const result = await runBinary(DEEP_BINARY, { format: 'findings' });
    expect(problems(table(result).rows)).toContain('Nesting is deeper than 64 levels');
    const depth = (await runBinary(DEEP_BINARY)).stats?.depth;
    expect(Number(depth)).toBe(64);
  });

  it('decodes UID objects and explains them', async () => {
    const map = treeMap((await view(UID_BINARY, 'tree')).rows);
    expect(map.get('root.Ref')).toBe('UID 7');
    expect(problems((await view(UID_BINARY, 'findings')).rows)).toContain('UID values are present');
  });

  it('notes objects that nothing references', async () => {
    expect(problems((await view(UNREACHABLE, 'findings')).rows)).toContain('1 object(s) are never referenced');
  });

  it('notes bytes sitting between the offset table and the trailer', async () => {
    const found = problems((await view(TRAILING, 'findings')).rows);
    expect(found.some((problem) => /byte\(s\) sit between the tables/u.test(problem))).toBe(true);
  });

  it('flags a duplicate dictionary key', async () => {
    const result = await runBinary(DUPLICATE, { format: 'findings' });
    expect(problems(table(result).rows)).toContain('Duplicate key in a dictionary');
    const map = treeMap((await view(DUPLICATE, 'tree')).rows);
    expect(map.get('root.k')).toBe('2');
  });

  it('cuts a reference cycle off instead of recursing forever', async () => {
    const result = await runBinary(CYCLIC, { format: 'findings' });
    expect(problems(table(result).rows)).toContain('The structure contains a reference cycle');
    expect(result.stats?.findings).toBeGreaterThan(0);
    const map = treeMap((await view(CYCLIC, 'tree')).rows);
    expect(map.get('root[0]')).toBe('(reference back to an enclosing value)');
  });

  it('stays bounded on a structure that doubles at every level', async () => {
    // The walk would otherwise visit 2^31 values; the row budget and the read cache
    // must keep this fast enough for the default test timeout to be the real guard.
    const result = await runBinary(BLOWUP, { format: 'tree' });
    const rows = table(result).rows;
    expect(rows.length).toBe(2000);
    expect(result.notes?.join(' ')).toMatch(/only the first 2000 tree rows/i);
    expect(result.stats?.objects).toBeLessThan(40);
  });

  it('rejects a binary plist with an unsupported version', async () => {
    let error: { message: string; hint?: string } | null = null;
    try {
      await runBinary(BADMAGIC);
    } catch (caught) {
      error = caught as { message: string; hint?: string };
    }
    expect(error?.message).toMatch(/could not be decoded/u);
    expect(error?.hint).toMatch(/version 99 is not supported/u);
  });

  it('rejects a truncated binary plist', async () => {
    await expect(runText('bplist00 short')).rejects.toThrow(/too short|not be decoded/u);
  });

  it('rejects XML that is not a property list', async () => {
    await expect(runText('<?xml version="1.0"?><foo><bar/></foo>')).rejects.toThrow(/not a property list/u);
  });

  it('rejects malformed XML', async () => {
    await expect(runText('<?xml version="1.0"?><plist><dict><key>x</key>')).rejects.toThrow(/could not be parsed/u);
  });

  it('rejects an empty plist', async () => {
    await expect(runText('<?xml version="1.0"?><plist version="1.0"></plist>')).rejects.toThrow(/no value/u);
  });

  it('rejects empty input', async () => {
    await expect(runText('')).rejects.toThrow(/no property list was provided/iu);
  });

  it('notes a DOCTYPE without resolving entities', async () => {
    const xml =
      '<?xml version="1.0"?>\n<!DOCTYPE plist [<!ENTITY x "y">]>\n<plist version="1.0"><dict><key>a</key><string>plain</string></dict></plist>';
    const result = await runText(xml, { format: 'findings' });
    expect(problems(table(result).rows)).toContain('The XML declares a DOCTYPE');
    expect(treeMap(table(await runText(xml, { format: 'tree' })).rows).get('root.a')).toBe('plain');
  });

  it('notes an unexpected plist version in XML', async () => {
    const xml = '<?xml version="1.0"?><plist version="2.0"><dict><key>a</key><true/></dict></plist>';
    const result = await runText(xml, { format: 'findings' });
    expect(problems(table(result).rows)).toContain('Unexpected plist version');
  });

  it('handles every XML value type', async () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<plist version="1.0"><dict>',
      '<key>s</key><string>text</string>',
      '<key>i</key><integer>-12</integer>',
      '<key>r</key><real>0.25</real>',
      '<key>t</key><true/>',
      '<key>f</key><false/>',
      '<key>d</key><date>2021-03-04T05:06:07Z</date>',
      '<key>b</key><data>AQID</data>',
      '<key>arr</key><array><integer>1</integer><string>2</string></array>',
      '</dict></plist>',
    ].join('');
    const map = treeMap((await viewText(xml, 'tree')).rows);
    expect(map.get('root.s')).toBe('text');
    expect(map.get('root.i')).toBe('-12');
    expect(map.get('root.r')).toBe('0.25');
    expect(map.get('root.t')).toBe('true');
    expect(map.get('root.f')).toBe('false');
    expect(map.get('root.d')).toBe('2021-03-04T05:06:07.000Z');
    expect(map.get('root.b')).toBe('3 bytes');
    expect(map.get('root.arr[1]')).toBe('2');
    expect((await viewText(xml, 'tree', { dataPreview: true })).rows.length).toBeGreaterThan(8);
  });

  it('reports unreadable XML values', async () => {
    const xml = '<?xml version="1.0"?><plist version="1.0"><dict><key>bad</key><integer>abc</integer></dict></plist>';
    const result = await runText(xml, { format: 'findings' });
    expect(problems(table(result).rows)).toContain('An <integer> is not a number');
    expect(result.warnings?.join(' ')).toMatch(/structural error/u);
  });
});
