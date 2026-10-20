import { describe, it, expect } from 'vitest';
import { ToolError, type BothRunResult, type OptionValues } from '@/lib/types';
import { getTool, redirectTarget, SEARCH_INDEX, VISIBLE_TOOLS } from '@/lib/registry';
import tool from './base64.tool';

interface Payload {
  text?: string;
  files?: File[];
  options?: OptionValues;
  signal?: AbortSignal;
}

const run = (payload: Payload): Promise<BothRunResult> =>
  tool.run({ ...payload, options: payload.options ?? {} });

const enc = async (text: string, options: OptionValues = {}) =>
  (await run({ text, files: [], options: { mode: 'encode', ...options } })).report?.output ?? '';
const dec = async (text: string, options: OptionValues = {}) =>
  (await run({ text, files: [], options: { mode: 'decode', ...options } })).report?.output ?? '';

const textFile = (name: string, content: string) => new File([content], name);
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const errorOf = async (p: Promise<unknown>) => (await p.catch((e: unknown) => e)) as ToolError;

describe('base64 — text mode', () => {
  it('encodes ASCII to Base64 code text', async () => {
    const result = await run({ text: 'hello world', files: [], options: { mode: 'encode' } });
    expect(result.report?.output).toBe('aGVsbG8gd29ybGQ=');
    expect(result.report?.render).toBe('code');
    expect(result.report?.language).toBe('base64');
    expect(result.outputs[0]?.filename).toBe('base64.txt');
    expect(await result.outputs[0]!.blob.text()).toBe('aGVsbG8gd29ybGQ=');
    expect(result.stats).toMatchObject({ 'input bytes': 11, 'output chars': 16 });
  });

  it('decodes ASCII', async () => {
    expect(await dec('aGVsbG8gd29ybGQ=')).toBe('hello world');
  });

  it('round-trips UTF-8 / emoji', async () => {
    const s = 'I ❤ Toolbench — çà et là';
    expect(await dec(await enc(s))).toBe(s);
  });

  it('produces URL-safe output without padding', async () => {
    const out = await enc('<<???>>', { urlSafe: true });
    expect(out).not.toMatch(/[+/=]/);
    expect(await dec(out)).toBe('<<???>>');
  });

  it('accepts URL-safe input on decode', async () => {
    const std = await enc('subjects?_d=1');
    const url = std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(await dec(url)).toBe('subjects?_d=1');
  });

  it('accepts a data URI prefix on decode', async () => {
    expect(await dec('data:text/plain;base64,aGVsbG8=')).toBe('hello');
  });

  it('ignores whitespace / newlines when decoding', async () => {
    expect(await dec('aGVs\nbG8g\td29ybGQ=')).toBe('hello world');
  });

  it('wraps encoded output at 76 chars', async () => {
    const out = await enc('x'.repeat(120), { wrap: true });
    const lines = out.split('\n');
    expect(lines[0]).toHaveLength(76);
    expect(lines.every((l) => l.length <= 76)).toBe(true);
    expect(lines.join('')).toBe('eHh4'.repeat(40));
  });

  it('combines URL-safe and wrap options', async () => {
    const out = await enc('ü'.repeat(80), { urlSafe: true, wrap: true });
    expect(out).not.toMatch(/[+/=]/);
    expect(out.split('\n').every((l) => l.length <= 76)).toBe(true);
  });

  it('returns an empty result for empty input (unchanged behaviour)', async () => {
    const encoded = await run({ text: '', files: [], options: { mode: 'encode' } });
    expect(encoded.report?.output).toBe('');
    expect(encoded.outputs).toEqual([]);
    const decoded = await run({ text: '', files: [], options: { mode: 'decode' } });
    expect(decoded.report?.output).toBe('');
    expect(decoded.outputs).toEqual([]);
  });

  it('throws a ToolError with a hint on invalid Base64', async () => {
    const err = await errorOf(run({ text: 'not*valid*base64', files: [], options: { mode: 'decode' } }));
    expect(err).toBeInstanceOf(ToolError);
    expect(err.message).toMatch(/valid Base64/i);
    expect(err.hint).toBeTruthy();
  });

  it('rejects a Base64 length that cannot be padded', async () => {
    await expect(run({ text: 'AAAAA', files: [], options: { mode: 'decode' } })).rejects.toThrow(
      ToolError,
    );
  });

  it('throws a ToolError for an unknown direction', async () => {
    await expect(run({ text: 'x', files: [], options: { mode: 'sideways' } })).rejects.toThrow(
      /Unknown direction/i,
    );
  });

  it('warns when decoded bytes are not valid UTF-8 text', async () => {
    const result = await run({ text: '//4=', files: [], options: { mode: 'decode' } });
    expect(result.notes?.[0]).toMatch(/replacement characters/i);
  });

  it('names the decoded text download after outputName', async () => {
    const def = await run({ text: 'aGk=', files: [], options: { mode: 'decode' } });
    expect(def.outputs[0]?.filename).toBe('decoded.bin');
    const custom = await run({
      text: 'aGk=',
      files: [],
      options: { mode: 'decode', outputName: '../note.txt' },
    });
    expect(custom.outputs[0]?.filename).toBe('.._note.txt');
    expect(await custom.outputs[0]!.blob.text()).toBe('hi');
  });

  it('runs every declared example without error', async () => {
    for (const ex of tool.meta.examples ?? []) {
      const result = await run({ text: ex.input ?? '', files: [], options: ex.options ?? {} });
      expect(result.report?.output, ex.title).toBeTruthy();
    }
  });
});

describe('base64 — file mode', () => {
  it('encodes binary file bytes and provides a downloadable text file', async () => {
    const result = await run({ files: [new File([new Uint8Array([0, 1, 255])], 'data.bin')] });
    expect(result.report?.output).toBe('AAH/');
    expect(await result.outputs[0]!.blob.text()).toBe('AAH/');
    expect(result.outputs[0]!.filename).toBe('data.bin.base64.txt');
    expect(result.stats).toMatchObject({ 'input bytes': 3, 'output chars': 4 });
  });

  it('honours the URL-safe option when encoding a file', async () => {
    const result = await run({
      files: [new File([new Uint8Array([251, 255])], 'raw.bin')],
      options: { urlSafe: true },
    });
    expect(result.report?.output).toBe('-_8');
    expect(result.outputs[0]?.filename).toBe('raw.bin.base64.txt');
  });

  it('honours the wrap option when encoding a file', async () => {
    const result = await run({
      files: [new File([new Uint8Array(60).fill(255)], 'big.bin')],
      options: { wrap: true },
    });
    const lines = (result.report?.output ?? '').split('\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= 76)).toBe(true);
  });

  it('decodes Base64 text to bytes using a safe output name', async () => {
    const result = await run({
      files: [textFile('encoded.txt', 'data:application/octet-stream;base64,AAH/')],
      options: { mode: 'decode', outputName: '../payload.bin' },
    });
    expect(result.outputs[0]?.filename).toBe('.._payload.bin');
    expect([...(await bytesOf(result.outputs[0]!.blob))]).toEqual([0, 1, 255]);
  });

  it('falls back to decoded.bin when outputName is blank', async () => {
    const result = await run({
      files: [textFile('encoded.txt', 'AAH/')],
      options: { mode: 'decode', outputName: '   ' },
    });
    expect(result.outputs[0]?.filename).toBe('decoded.bin');
  });

  it('round-trips a larger payload through encode then decode', async () => {
    const original = new Uint8Array(50_000);
    for (let i = 0; i < original.length; i++) original[i] = (i * 31) & 0xff;

    const encoded = await run({ files: [new File([original], 'payload.bin')] });
    expect(encoded.report?.output).toHaveLength(66_668);

    const decoded = await run({
      files: [textFile(encoded.outputs[0]!.filename, encoded.report!.output)],
      options: { mode: 'decode', outputName: 'payload-copy.bin' },
    });
    expect(await bytesOf(decoded.outputs[0]!.blob)).toEqual(original);
  });

  it('uses the file instead of the text when both are provided', async () => {
    const result = await run({
      text: 'ignored text',
      files: [new File([new Uint8Array([0, 1, 255])], 'data.bin')],
      options: { mode: 'encode' },
    });
    expect(result.report?.output).toBe('AAH/');
  });

  it('uses only the first file', async () => {
    const result = await run({
      files: [
        new File([new Uint8Array([0])], 'first.bin'),
        new File([new Uint8Array([255])], 'second.bin'),
      ],
    });
    expect(result.report?.output).toBe('AA==');
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]?.filename).toBe('first.bin.base64.txt');
  });

  it('encodes an empty file to an empty Base64 file', async () => {
    const result = await run({ files: [new File([], 'empty.bin')] });
    expect(result.report?.output).toBe('');
    expect(result.outputs[0]?.blob.size).toBe(0);
  });

  it('rejects a Base64 file with no content', async () => {
    await expect(
      run({ files: [textFile('blank.txt', '  \n ')], options: { mode: 'decode' } }),
    ).rejects.toThrow(/nothing to decode/i);
  });

  it('rejects invalid Base64 content in a file', async () => {
    await expect(
      run({ files: [textFile('bad.txt', 'a?')], options: { mode: 'decode' } }),
    ).rejects.toThrow(/valid Base64/i);
  });

  it('skips the inline report when the encoded text is very large', async () => {
    const result = await run({ files: [new File([new Uint8Array(800_000)], 'huge.bin')] });
    expect(result.report).toBeUndefined();
    expect(result.outputs[0]?.blob.size).toBeGreaterThan(1_000_000);
    expect(result.notes?.[0]).toMatch(/too large to show/i);
  });

  it('refuses files above the safety limit', async () => {
    const stub = {
      name: 'big.bin',
      size: 65 * 1024 * 1024,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as File;
    const err = await errorOf(run({ files: [stub] }));
    expect(err).toBeInstanceOf(ToolError);
    expect(err.message).toMatch(/too large/i);
    expect(err.hint).toMatch(/64 MB/);
  });

  it('reports progress and completion while encoding a file', async () => {
    const seen: { fraction: number; message?: string }[] = [];
    const result = await tool.run({
      files: [new File([new Uint8Array(1024)], 'progress.bin')],
      options: {},
      onProgress: (fraction, message) => seen.push({ fraction, message }),
    });
    expect(result.outputs).toHaveLength(1);
    expect(seen[0]).toEqual({ fraction: 0, message: 'Reading file' });
    expect(seen.at(-1)).toEqual({ fraction: 1, message: 'Done' });
    expect(seen.every((s, i) => i === 0 || s.fraction >= seen[i - 1]!.fraction)).toBe(true);
  });

  it('honours an aborted signal for encode and decode', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      run({ files: [new File([new Uint8Array([1])], 'a.bin')], signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      run({
        files: [textFile('a.txt', 'AQ==')],
        options: { mode: 'decode' },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws when called with no input at all', async () => {
    const err = await errorOf(tool.run({ files: [], options: {} }));
    expect(err).toBeInstanceOf(ToolError);
    expect(err.message).toMatch(/nothing to process/i);
    expect(err.hint).toBeTruthy();
  });
});

describe('base64 — metadata', () => {
  it('meta id matches filename and accepts both text and files', () => {
    expect(tool.meta.id).toBe('base64');
    expect(tool.meta.input).toBe('both');
    expect(tool.meta.status).toBe('stable');
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });
});

describe('base64 — alias wiring for base64-file', () => {
  it('exposes base64 as the visible, non-alias replacement', () => {
    const target = getTool('base64');
    expect(target).toBeTruthy();
    expect(target?.meta.hidden).not.toBe(true);
    expect(target?.meta.redirectTo).toBeUndefined();
    expect(target?.meta.category).toBe('encoding');
  });

  it('keeps base64-file routable as a hidden one-hop redirect', () => {
    const legacy = getTool('base64-file');
    expect(legacy, 'base64-file should still resolve').toBeTruthy();
    expect(legacy?.meta.hidden).toBe(true);
    expect(legacy?.meta.redirectTo).toBe('base64');
    expect(legacy?.meta.category).toBe('archive');
    const target = redirectTarget(legacy!.meta);
    expect(target?.meta.id).toBe('base64');
    expect(target?.meta.redirectTo).toBeUndefined();
  });

  it('drops the alias from listings and search', () => {
    expect(VISIBLE_TOOLS.some((t) => t.meta.id === 'base64-file')).toBe(false);
    expect(SEARCH_INDEX.some((e) => e.id === 'base64-file')).toBe(false);
    expect(VISIBLE_TOOLS.some((t) => t.meta.id === 'base64')).toBe(true);
    expect(SEARCH_INDEX.some((e) => e.id === 'base64')).toBe(true);
  });
});
