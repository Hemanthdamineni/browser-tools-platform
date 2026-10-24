import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { makeInvalidPdf, makePdf } from './pdf-test-helpers';
import { minimalEncryptedPdf } from './pdf-protect.fixtures';
import type { QpdfEngine } from './pdf-unlock.core';
import { loadQpdfEngine } from './pdf-unlock.qpdf';
import tool from './pdf-unlock.tool';

// The one module that reaches for 1.3 MB of WebAssembly. Everything else in the
// tool runs for real; `loadQpdfEngine` is replaced so a test can stand in an
// engine that reports exactly what that test needs.
vi.mock('./pdf-unlock.qpdf', () => ({ loadQpdfEngine: vi.fn() }));

const mockedLoad = vi.mocked(loadQpdfEngine);

interface EngineSpy extends QpdfEngine {
  passwords: string[];
  inputs: Uint8Array[];
}

/** An engine that records what it was asked to do and returns `output`. */
function spyEngine(output: Uint8Array<ArrayBuffer>): EngineSpy {
  const spy: EngineSpy = {
    passwords: [],
    inputs: [],
    decrypt(bytes, password) {
      spy.inputs.push(bytes);
      spy.passwords.push(password);
      return output;
    },
  };
  return spy;
}

/** An engine that fails the way qpdf does when it dislikes an input. */
function refusingEngine(error: ToolError): QpdfEngine {
  return {
    decrypt() {
      throw error;
    },
  };
}

/** A real, unencrypted PDF the engine can "return" after decryption. */
async function plainPdfBytes(): Promise<Uint8Array<ArrayBuffer>> {
  const file = await makePdf(2);
  return new Uint8Array(await file.arrayBuffer());
}

/** An input file whose trailer carries an /Encrypt entry, so pdf-lib sees it as protected. */
function encryptedFile(): File {
  const bytes = minimalEncryptedPdf();
  return new File([bytes], 'sample.pdf', { type: 'application/pdf' });
}

async function runWith(
  engine: QpdfEngine | Error,
  options: Record<string, string | number | boolean> = { password: 'hunter2' },
  files?: File[],
): Promise<FileRunResult> {
  if (engine instanceof Error) mockedLoad.mockRejectedValue(engine);
  else mockedLoad.mockResolvedValue(engine);
  const input: FileRunInput = {
    files: files ?? [encryptedFile()],
    options,
  };
  return tool.run(input);
}

beforeEach(() => {
  mockedLoad.mockReset();
});

describe('pdf-unlock run()', () => {
  it('returns the unlocked file under a new name', async () => {
    const output = await plainPdfBytes();
    const result = await runWith(spyEngine(output));

    expect(result.outputs).toHaveLength(1);
    const produced = result.outputs[0]!;
    expect(produced.filename).toBe('sample-unlocked.pdf');
    expect(produced.blob.type).toBe('application/pdf');
    expect(await produced.blob.text()).toContain('%PDF-');
  });

  it('hands the engine the chosen file bytes and the password, unchanged', async () => {
    const file = encryptedFile();
    const expected = new Uint8Array(await file.arrayBuffer());
    const output = await plainPdfBytes();
    const engine = spyEngine(output);
    await runWith(engine, { password: 'open-sesame' }, [file]);
    expect(engine.passwords).toEqual(['open-sesame']);
    expect(Array.from(engine.inputs[0]!)).toEqual(Array.from(expected));
  });

  it('reports the unlocked page count and the sizes', async () => {
    const output = await plainPdfBytes();
    const result = await runWith(spyEngine(output));
    expect(result.stats).toMatchObject({ pages: 2 });
    expect(String(result.stats?.input)).toMatch(/B$/);
    expect(String(result.stats?.output)).toMatch(/B$/);
    expect(result.notes?.join(' ')).toMatch(/no password is ever guessed/i);
    expect(result.notes?.join(' ')).toMatch(/opens without one/);
  });

  it('shows the wasm download as a progress step of its own', async () => {
    const output = await plainPdfBytes();
    const fractions: number[] = [];
    const input: FileRunInput = {
      files: [encryptedFile()],
      options: { password: 'pw' },
      onProgress: (fraction: number) => fractions.push(fraction),
    };
    mockedLoad.mockResolvedValue(spyEngine(output));
    await tool.run(input);
    expect(fractions).toContain(0.2);
    expect(fractions[0]).toBe(0.02);
    expect(fractions[fractions.length - 1]).toBe(1);
  });

  it('refuses an unencrypted PDF before loading the engine', async () => {
    const file = await makePdf(1);
    await expect(runWith(spyEngine(new Uint8Array()), { password: 'pw' }, [file])).rejects.toThrow(
      /not password-protected/,
    );
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('rejects an empty password before loading the engine', async () => {
    await expect(runWith(spyEngine(new Uint8Array()), { password: '' })).rejects.toThrow(
      /Enter the password/,
    );
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('reports a wrong password from the engine as a ToolError', async () => {
    const error = new ToolError('The password is wrong.', 'Check the password.');
    await expect(runWith(refusingEngine(error))).rejects.toThrow(/password is wrong/);
  });

  it('rejects a non-PDF file', async () => {
    await expect(
      runWith(spyEngine(new Uint8Array()), { password: 'pw' }, [makeInvalidPdf()]),
    ).rejects.toThrow(/not a PDF/);
  });

  it('rejects a file whose decryption still reports encrypted', async () => {
    const output = minimalEncryptedPdf();
    await expect(runWith(spyEngine(output))).rejects.toThrow(/still password-protected/);
  });
});
