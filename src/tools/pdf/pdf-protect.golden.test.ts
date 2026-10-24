import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makePdf } from './pdf-test-helpers';
import { createCliEngine, hasQpdfTool, runQpdf, writeTempPdf } from './pdf-protect.fixtures';
import { inspectPdf } from './pdf-protect.core';
import { loadQpdfEngine } from './pdf-protect.qpdf';
import tool from './pdf-protect.tool';

/*
 * Golden tests: the same argument list this tool builds is handed to the `qpdf`
 * command line, and the *result* is read back with qpdf's own inspector. That is
 * the only way to prove the arguments mean what the option labels claim — 256-bit
 * AES, and exactly the permissions the user asked for.
 *
 * The shipped wasm build cannot be driven from jsdom (Emscripten resolves its
 * `.wasm` through `fetch`/`XMLHttpRequest`, both of which need a real page), so
 * the wasm module itself is covered by the browser run of the built tool and
 * these tests pin the semantics of what it is asked to do. `qpdf` is the
 * reference implementation of the same CLI.
 */
vi.mock('./pdf-protect.qpdf', () => ({ loadQpdfEngine: vi.fn() }));

vi.mocked(loadQpdfEngine).mockImplementation(async () => createCliEngine());

const tempDirs: string[] = [];

/** Register a temporary file's directory for cleanup after the test. */
function keepDir<T extends { dir: string }>(temp: T): T {
  tempDirs.push(temp.dir);
  return temp;
}

function encryptionReport(path: string, password: string): string {
  return runQpdf(['--show-encryption', `--password=${password}`, path]);
}

function qpdfExitCode(args: string[]): number {
  try {
    execFileSync('qpdf', args, { stdio: 'ignore' });
    return 0;
  } catch (error) {
    return error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number'
      ? error.status
      : -1;
  }
}

/** The permission lines of `--show-encryption`, without qpdf's chatter. */
function permissionLines(report: string): string[] {
  return report
    .split('\n')
    .filter((line) => /^(print|extract|modify)/.test(line.trim()))
    .map((line) => line.trim());
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe.runIf(hasQpdfTool())('pdf-protect golden round trip', () => {
  it('writes a revision-6 AES-256 file with printing, copying and editing blocked', async () => {
    const result = await tool.run({
      files: [await makePdf(2)],
      options: {
        userPassword: 'open-sesame',
        allowPrint: false,
        allowCopy: false,
        allowModify: false,
      },
    });
    const output = result.outputs[0]!;
    expect(output.filename).toBe('sample-protected.pdf');

    const { dir, path } = keepDir(writeTempPdf(new Uint8Array(await output.blob.arrayBuffer())));
    const report = encryptionReport(path, 'open-sesame');

    // The strongest encryption the PDF standard defines.
    expect(report).toMatch(/^R = 6$/m);
    expect(report).toMatch(/stream encryption method: AESv3/);
    expect(report).toMatch(/file encryption method: AESv3/);

    // Exactly the restrictions that were asked for. `--extract=n` covers
    // extraction "for any purpose"; extraction for accessibility is a separate
    // permission (screen readers need it), and neither qpdf nor this tool
    // touches it unless asked.
    expect(permissionLines(report)).toEqual([
      'extract for accessibility: allowed',
      'extract for any purpose: not allowed',
      'print low resolution: not allowed',
      'print high resolution: not allowed',
      'modify document assembly: not allowed',
      'modify forms: not allowed',
      'modify annotations: not allowed',
      'modify other: not allowed',
      'modify anything: not allowed',
    ]);

    // Locked for real: no password, the wrong password, both refused.
    expect(qpdfExitCode(['--is-encrypted', path])).toBe(0);
    expect(qpdfExitCode(['--decrypt', path, `${dir}/nopw.pdf`])).toBe(2);
    expect(qpdfExitCode(['--decrypt', '--password=nope', path, `${dir}/bad.pdf`])).toBe(2);

    // The user password opens it, and the pages survive the round trip.
    const plainPath = `${dir}/plain.pdf`;
    expect(qpdfExitCode(['--decrypt', '--password=open-sesame', path, plainPath])).toBe(0);
    const plain = await inspectPdf(new Uint8Array(readFileSync(plainPath)));
    expect(plain).toEqual({ encrypted: false, pages: 2 });

    // And the tool's own verdict on its output agrees.
    await expect(
      inspectPdf(new Uint8Array(await output.blob.arrayBuffer())),
    ).resolves.toMatchObject({ encrypted: true });
  }, 30_000);

  it('leaves everything allowed when no restriction was asked for', async () => {
    const result = await tool.run({
      files: [await makePdf(1)],
      options: { userPassword: 'open-sesame' },
    });
    const { path } = keepDir(
      writeTempPdf(new Uint8Array(await result.outputs[0]!.blob.arrayBuffer())),
    );
    const report = encryptionReport(path, 'open-sesame');

    expect(permissionLines(report)).toEqual([
      'extract for accessibility: allowed',
      'extract for any purpose: allowed',
      'print low resolution: allowed',
      'print high resolution: allowed',
      'modify document assembly: allowed',
      'modify forms: allowed',
      'modify annotations: allowed',
      'modify other: allowed',
      'modify anything: allowed',
    ]);
  }, 30_000);

  it('keeps copying allowed while editing is blocked', async () => {
    // `--modify=none` must not drag `--extract` down with it.
    const result = await tool.run({
      files: [await makePdf(1)],
      options: { userPassword: 'open-sesame', allowModify: false },
    });
    const { path } = keepDir(
      writeTempPdf(new Uint8Array(await result.outputs[0]!.blob.arrayBuffer())),
    );
    const report = encryptionReport(path, 'open-sesame');

    expect(report).toMatch(/extract for any purpose: allowed/);
    expect(report).toMatch(/print high resolution: allowed/);
    expect(report).toMatch(/modify anything: not allowed/);
  }, 30_000);

  it('only blocks printing when printing was the only thing refused', async () => {
    const result = await tool.run({
      files: [await makePdf(1)],
      options: { userPassword: 'open-sesame', allowPrint: false },
    });
    const { path } = keepDir(
      writeTempPdf(new Uint8Array(await result.outputs[0]!.blob.arrayBuffer())),
    );
    const report = encryptionReport(path, 'open-sesame');

    expect(report).toMatch(/print high resolution: not allowed/);
    expect(report).toMatch(/extract for any purpose: allowed/);
    expect(report).toMatch(/modify anything: allowed/);
  }, 30_000);

  it('survives a password with spaces, quotes, backslashes and emoji', async () => {
    const userPassword = ' a "b\\c 😀 ';
    const result = await tool.run({
      files: [await makePdf(1)],
      options: { userPassword, ownerPassword: userPassword },
    });
    const { dir, path } = keepDir(
      writeTempPdf(new Uint8Array(await result.outputs[0]!.blob.arrayBuffer())),
    );

    expect(qpdfExitCode(['--is-encrypted', path])).toBe(0);
    expect(
      qpdfExitCode(['--decrypt', `--password=${userPassword}`, path, `${dir}/plain.pdf`]),
    ).toBe(0);
    // A near miss — the spaces are part of the password, not padding.
    expect(qpdfExitCode(['--decrypt', '--password=a "b\\c 😀', path, `${dir}/near.pdf`])).toBe(2);
    expect(encryptionReport(path, userPassword)).toMatch(/^R = 6$/m);
  }, 30_000);

  it('uses a separate owner password that keeps full access', async () => {
    const result = await tool.run({
      files: [await makePdf(1)],
      options: { userPassword: 'reader', ownerPassword: 'keeper', allowModify: false },
    });
    const { dir, path } = keepDir(
      writeTempPdf(new Uint8Array(await result.outputs[0]!.blob.arrayBuffer())),
    );

    // The user password is restricted, the owner password is not.
    expect(encryptionReport(path, 'keeper')).toMatch(/Supplied password is owner password/);
    expect(encryptionReport(path, 'reader')).toMatch(/Supplied password is user password/);
    expect(qpdfExitCode(['--decrypt', '--password=keeper', path, `${dir}/ok.pdf`])).toBe(0);
    expect(qpdfExitCode(['--decrypt', '--password=reader', path, `${dir}/ok2.pdf`])).toBe(0);
  }, 30_000);
});
