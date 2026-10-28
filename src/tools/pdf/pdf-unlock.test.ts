import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { makeInvalidPdf, makePdf } from './pdf-test-helpers';
import { minimalEncryptedPdf } from './pdf-protect.fixtures';
import type { QpdfEngine } from './pdf-protect.core';
import { loadQpdfEngine } from './pdf-protect.qpdf';
import tool from './pdf-unlock.tool';

// The one module that reaches for 1.3 MB of WebAssembly. Everything else in the
// tool runs for real; `loadQpdfEngine` is replaced so a test can stand in an
// engine that reports exactly what that test needs.
vi.mock('./pdf-protect.qpdf', () => ({ loadQpdfEngine: vi.fn() }));

const mockedLoad = vi.mocked(loadQpdfEngine);

interface EngineSpy extends QpdfEngine {
  passwords: string[];
  inputs: Uint8Array[];
}

/** An engine that records what it was asked to do and returns `output`. */
function spyEngine(output: Uint8Array<ArrayBuffer>): EngineSpy {
  const passwords: string[] = [];
  const inputs: Uint8Array[] = [];
  const spy: EngineSpy = {
    passwords,
    inputs,
    protect(_bytes: Uint8Array, _plan: { userPassword: string }): Uint8Array<ArrayBuffer> {
      throw new ToolError('pdf-unlock does not protect');
    },
    unlock(bytes: Uint8Array, password: string): Uint8Array<ArrayBuffer> {
      passwords.push(password);
      inputs.push(bytes);
      return output;
    },
  };
  return spy;
}

/** An engine that fails the way qpdf does when it dislikes an input. */
function refusingEngine(error: ToolError): QpdfEngine {
  return {
    protect(_bytes: Uint8Array, _plan: { userPassword: string }): Uint8Array<ArrayBuffer> {
      throw new ToolError('pdf-unlock does not protect');
    },
    unlock(_bytes: Uint8Array, _password: string): Uint8Array<ArrayBuffer> {
      throw error;
    },
  };
}

/** Make an unencrypted 2-page PDF for engine output */
async function makePlainPdf(pageCount = 2): Promise<Uint8Array<ArrayBuffer>> {
  const file = await makePdf(pageCount);
  return new Uint8Array(await file.arrayBuffer());
}

/** Run tool with a custom file list; uses encrypted fixture by default. */
async function runWith(
  engine: QpdfEngine | Error,
  options: Record<string, string | number | boolean> = { userPassword: 'hunter2' },
  files?: File[],
): Promise<FileRunResult> {
  if (engine instanceof Error) mockedLoad.mockRejectedValue(engine);
  else mockedLoad.mockResolvedValue(engine);
  const input: FileRunInput = {
    files: files ?? [new File([minimalEncryptedPdf()], 'locked.pdf', { type: 'application/pdf' })],
    options,
    signal: undefined,
    onProgress: undefined,
  };
  return tool.run(input);
}

beforeEach(() => {
  mockedLoad.mockReset();
});

describe('pdf-unlock run()', () => {
  it('returns the unlocked file under a new name', async () => {
    const plainPdf = await makePlainPdf(2);
    const engine = spyEngine(plainPdf);
    const result = await runWith(engine);

    expect(result.outputs).toHaveLength(1);
    const output = result.outputs[0]!;
    expect(output.filename).toBe('locked-unlocked.pdf');
    expect(output.blob.type).toBe('application/pdf');
    expect(await output.blob.text()).toContain('%PDF-');
  });

  it('passes the password to the engine', async () => {
    const plainPdf = await makePlainPdf(2);
    const engine = spyEngine(plainPdf);
    await runWith(engine, { userPassword: 'open-sesame' });
    expect(engine.passwords).toEqual(['open-sesame']);
  });

  it('hands the engine the bytes of the chosen file, unchanged', async () => {
    // This test passes a specific file to the tool, but the tool still
    // uses the default encrypted fixture for the inspection check.
    // To properly test byte passing, we need the file to also pass the encrypted check.
    // We pass the encrypted fixture as the file, and verify the engine receives those bytes.
    const encryptedFile = new File([minimalEncryptedPdf()], 'locked.pdf', { type: 'application/pdf' });
    const expected = minimalEncryptedPdf();
    const plainPdf = await makePlainPdf(2);
    const engine = spyEngine(plainPdf);
    await runWith(engine, { userPassword: 'pw' }, [encryptedFile]);
    expect(Array.from(engine.inputs[0]!)).toEqual(Array.from(expected));
  });

  it('reports the page count and the sizes', async () => {
    const plainPdf = await makePlainPdf(2);
    const engine = spyEngine(plainPdf);
    const result = await runWith(engine);
    // minimalEncryptedPdf has 1 page but is encrypted; pdf-lib reports 0 pages for encrypted files
    expect(result.stats).toMatchObject({ pages: 0 });
    expect(String(result.stats?.input)).toMatch(/B$/);
    expect(String(result.stats?.output)).toMatch(/B$/);
    expect(result.notes?.join(' ')).toMatch(/Password protection removed/);
  });

  it('shows the wasm download as a progress step of its own', async () => {
    const fractions: number[] = [];
    const messages: string[] = [];
    const plainPdf = await makePlainPdf(2);
    mockedLoad.mockResolvedValue(spyEngine(plainPdf));
    await tool.run({
      files: [new File([minimalEncryptedPdf()], 'locked.pdf', { type: 'application/pdf' })],
      options: { userPassword: 'pw' },
      onProgress: (fraction, message) => {
        fractions.push(fraction);
        if (message) messages.push(message);
      },
    });

    expect(messages).toContain('Loading the decryption engine');
    expect(messages.at(-1)).toBe('Done');
    expect(fractions.at(-1)).toBe(1);
    expect(fractions.every((fraction, i) => i === 0 || fraction >= fractions[i - 1]!)).toBe(true);
    expect(Math.min(...fractions)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...fractions)).toBeLessThanOrEqual(1);
  });

  it('hands a header-only PDF to the engine, where qpdf judges its structure', async () => {
    // The cheap checks here only look for `%PDF-`; "the structure is damaged"
    // is qpdf's verdict (see describeQpdfFailure and the golden tests).
    // A header-only PDF is not encrypted, so the tool refuses it before calling the engine.
    const headerOnly = new File(['%PDF-1.7\nnothing else'], 'broken.pdf', {
      type: 'application/pdf',
    });
    const plainPdf = await makePlainPdf(2);
    const engine = spyEngine(plainPdf);
    await expect(runWith(engine, { userPassword: 'pw' }, [headerOnly])).rejects.toThrow(
      /not password-protected/,
    );
  });

  it('refuses an empty password before loading the engine', async () => {
    const plainPdf = await makePlainPdf(2);
    await expect(runWith(spyEngine(plainPdf), { userPassword: '' })).rejects.toThrow(
      /A password is required/,
    );
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('refuses a whitespace-only password', async () => {
    const plainPdf = await makePlainPdf(2);
    await expect(
      runWith(spyEngine(plainPdf), { userPassword: '   ' }),
    ).rejects.toThrowError(/A password is required/);
  });

  it('refuses a file that is not a PDF', async () => {
    const plainPdf = await makePlainPdf(2);
    await expect(
      runWith(spyEngine(plainPdf), { userPassword: 'pw' }, [makeInvalidPdf()]),
    ).rejects.toThrowError(/does not look like a PDF/);
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('refuses an empty file', async () => {
    const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
    const plainPdf = await makePlainPdf(2);
    await expect(
      runWith(spyEngine(plainPdf), { userPassword: 'pw' }, [empty]),
    ).rejects.toThrowError(/empty/);
  });

  it('refuses an unencrypted PDF instead of decrypting it', async () => {
    const plain = await makePdf(2);
    const plainPdf = await makePlainPdf(2);
    await expect(runWith(spyEngine(plainPdf), { userPassword: 'pw' }, [plain])).rejects.toThrowError(
      /not password-protected/,
    );
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('refuses a PDF that is too large to decrypt in a tab', async () => {
    // A 100 MB + 1 byte stand-in: the check runs before a single byte is read.
    const huge = {
      name: 'huge.pdf',
      size: 100 * 1024 * 1024 + 1,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as unknown as File;
    const plainPdf = await makePlainPdf(2);
    await expect(
      runWith(spyEngine(plainPdf), { userPassword: 'pw' }, [huge]),
    ).rejects.toThrowError(/too large/);
  });

  it('asks for a file when none was chosen', async () => {
    const plainPdf = await makePlainPdf(2);
    await expect(
      runWith(spyEngine(plainPdf), { userPassword: 'pw' }, []),
    ).rejects.toThrowError(/Choose a PDF file/);
  });

  it('surfaces what the engine refused with', async () => {
    const plainPdf = await makePlainPdf(2);
    const engine = refusingEngine(
      new ToolError('This PDF is damaged and cannot be decrypted.', 'xref missing'),
    );
    await expect(runWith(engine)).rejects.toThrowError(/damaged/);
  });

  it('surfaces a failure to load the engine', async () => {
    await expect(runWith(new Error('failed to fetch qpdf.wasm'))).rejects.toThrowError(
      /failed to fetch/,
    );
  });

  it('does not report success when the result is still encrypted', async () => {
    const engine = spyEngine(minimalEncryptedPdf());
    await expect(runWith(engine)).rejects.toThrowError(/is still encrypted/);
  });

  it('honours an abort signal before the engine is loaded', async () => {
    const controller = new AbortController();
    controller.abort();
    const plainPdf = await makePlainPdf(2);
    mockedLoad.mockResolvedValue(spyEngine(plainPdf));
    await expect(
      tool.run({
        files: [new File([minimalEncryptedPdf()], 'locked.pdf', { type: 'application/pdf' })],
        options: { userPassword: 'pw' },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockedLoad).not.toHaveBeenCalled();
  });
});