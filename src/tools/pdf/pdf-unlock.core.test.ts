import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import {
  assertPdfHeader,
  assertWithinLimit,
  buildDecryptArgs,
  classifyDecryptFailure,
  createQpdfEngine,
  inspectPdf,
  planUnlock,
  unlockedFilename,
  withStderrCapture,
  type QpdfLog,
  type QpdfModule,
} from './pdf-unlock.core';
import { makePdf } from './pdf-test-helpers';
import { asciiBytes, minimalEncryptedPdf } from './pdf-protect.fixtures';

/** Shared by the fake modules so `createQpdfEngine`'s buffers are the ones filled. */
const log: QpdfLog = { stderr: [] };

interface FakeModule extends QpdfModule {
  written: Uint8Array | undefined;
  calls: string[][];
}

/** A stand-in for the Emscripten module: an in-memory FS plus a scripted exit. */
function fakeModule(options: {
  exitCode?: number;
  stderr?: string[];
  output?: Uint8Array<ArrayBuffer> | null;
  throwOnCall?: Error;
}): FakeModule {
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const module: FakeModule = {
    written: undefined,
    calls: [],
    FS: {
      writeFile(path: string, data: Uint8Array): void {
        files.set(path, data.slice());
        module.written = data;
      },
      readFile(path: string): Uint8Array<ArrayBuffer> {
        const file = files.get(path);
        if (!file) throw new Error(`ENOENT: ${path}`);
        return file;
      },
    },
    callMain(args: string[]): number {
      module.calls.push(args);
      if (options.throwOnCall) throw options.throwOnCall;
      for (const line of options.stderr ?? []) {
        // The engine only ever reads the log the caller passed in; mirror qpdf
        // by appending to it here.
        log.stderr.push(line);
      }
      const output = options.output === undefined ? new Uint8Array([1, 2, 3]) : options.output;
      if (output) files.set(args[args.length - 1]!, output);
      return options.exitCode ?? 0;
    },
  };
  return module;
}

/* -------------------------------------------------------------------------- */
/*  Password validation                                                       */
/* -------------------------------------------------------------------------- */

describe('planUnlock', () => {
  it('accepts a normal password', () => {
    expect(planUnlock({ password: 'open-sesame' })).toEqual({ password: 'open-sesame' });
  });

  it('keeps spaces, quotes, backslashes, newlines, unicode and emoji intact', () => {
    const password = '  pa ss "q" \\ b / ünïcødé 😀 漢  ';
    expect(planUnlock({ password })).toEqual({ password });
  });

  it('rejects an empty password', () => {
    expect(() => planUnlock({})).toThrow(ToolError);
    expect(() => planUnlock({ password: '' })).toThrow(/Enter the password/);
  });

  it('rejects a whitespace-only password', () => {
    expect(() => planUnlock({ password: '   ' })).toThrow(/only spaces/);
  });
});

/* -------------------------------------------------------------------------- */
/*  Argument builder                                                          */
/* -------------------------------------------------------------------------- */

describe('buildDecryptArgs', () => {
  it('passes the password as a single --password word', () => {
    expect(buildDecryptArgs('hunter2')).toEqual([
      '--password=hunter2',
      '--decrypt',
      '--',
      '/input.pdf',
      '/unlocked.pdf',
    ]);
  });

  it('never re-quotes a password with spaces or special characters', () => {
    expect(buildDecryptArgs('pa ss "q" \\ 😀')).toEqual([
      '--password=pa ss "q" \\ 😀',
      '--decrypt',
      '--',
      '/input.pdf',
      '/unlocked.pdf',
    ]);
  });

  it('honours custom paths', () => {
    expect(buildDecryptArgs('pw', '/in', '/out')).toEqual([
      '--password=pw',
      '--decrypt',
      '--',
      '/in',
      '/out',
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Error classification                                                      */
/* -------------------------------------------------------------------------- */

describe('classifyDecryptFailure', () => {
  it('classifies a wrong password, and never hints at cracking', () => {
    const failure = classifyDecryptFailure(['qpdf: invalid password'], 2);
    expect(failure.kind).toBe('wrong-password');
    expect(failure.message).toBe('The password is wrong.');
    expect(failure.hint?.toLowerCase()).not.toMatch(/crack|brute force|guess/);
    expect(failure.hint).toMatch(/check the password/i);
  });

  it('recognises alternative wrong-password phrasings', () => {
    for (const line of [
      'incorrect password',
      'the password does not match',
      'authentication failed',
      'wrong password',
    ]) {
      expect(classifyDecryptFailure([line], 2).kind).toBe('wrong-password');
    }
  });

  it('classifies a damaged file as corrupt, with the engine line as hint', () => {
    const failure = classifyDecryptFailure(["can't find startxref"], 2);
    expect(failure.kind).toBe('corrupt');
    expect(failure.message).toMatch(/damaged|unsupported/i);
    expect(failure.hint).toBe("can't find startxref");
  });

  it('classifies a missing PDF header as corrupt', () => {
    const failure = classifyDecryptFailure(["can't find pdf header"], 2);
    expect(failure.kind).toBe('corrupt');
    expect(failure.message).toBe('This file is not a PDF.');
  });

  it('classifies an unencrypted file as not-encrypted', () => {
    const failure = classifyDecryptFailure(['this file is not encrypted'], 2);
    expect(failure.kind).toBe('not-encrypted');
    expect(failure.message).toMatch(/not password-protected/);
  });

  it('falls back to a neutral unknown message', () => {
    const failure = classifyDecryptFailure(['something odd happened'], 3);
    expect(failure.kind).toBe('unknown');
    expect(failure.message).toMatch(/exit code 3/);
    expect(failure.hint).toBe('something odd happened');
  });
});

/* -------------------------------------------------------------------------- */
/*  Input checks                                                              */
/* -------------------------------------------------------------------------- */

describe('assertPdfHeader', () => {
  it('accepts a PDF header', () => {
    expect(() => assertPdfHeader(asciiBytes('%PDF-1.7\n%%EOF'))).not.toThrow();
  });

  it('rejects an empty file', () => {
    expect(() => assertPdfHeader(new Uint8Array())).toThrow(/empty/);
  });

  it('rejects a non-PDF', () => {
    expect(() => assertPdfHeader(asciiBytes('not a pdf at all'))).toThrow(/not a PDF/);
  });
});

describe('assertWithinLimit', () => {
  it('rejects an oversized file', () => {
    expect(() => assertWithinLimit(101, 100)).toThrow(/too large/);
  });

  it('accepts a file at the limit', () => {
    expect(() => assertWithinLimit(100, 100)).not.toThrow();
  });
});

describe('inspectPdf', () => {
  it('sees a real PDF as unencrypted with its page count', async () => {
    const file = await makePdf(3);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await inspectPdf(bytes);
    expect(result.encrypted).toBe(false);
    expect(result.pages).toBe(3);
  });

  it('sees an encrypted trailer as encrypted with zero pages', async () => {
    const result = await inspectPdf(minimalEncryptedPdf());
    expect(result.encrypted).toBe(true);
    expect(result.pages).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  The engine                                                                */
/* -------------------------------------------------------------------------- */

describe('createQpdfEngine', () => {
  beforeEach(() => {
    log.stderr.length = 0;
  });

  it('hands the engine the bytes and returns the decrypted output', () => {
    const output = new Uint8Array([9, 8, 7]);
    const module = fakeModule({ output });
    const result = createQpdfEngine(module, log).decrypt(new Uint8Array([1, 2]), 'pw');
    expect(Array.from(result)).toEqual([9, 8, 7]);
    expect(module.calls).toEqual([
      ['--password=pw', '--decrypt', '--', '/input.pdf', '/unlocked.pdf'],
    ]);
    expect(Array.from(module.written!)).toEqual([1, 2]);
  });

  it('throws a wrong-password ToolError when qpdf refuses', () => {
    const module = fakeModule({ exitCode: 2, stderr: ['qpdf: invalid password'] });
    expect(() => createQpdfEngine(module, log).decrypt(new Uint8Array(), 'nope')).toThrow(
      /password is wrong/,
    );
  });

  it('redacts the password from any error message', () => {
    // A damaged-file line is surfaced verbatim as the hint, so this is where a
    // leaked password would end up on screen.
    const module = fakeModule({
      exitCode: 2,
      stderr: ['qpdf: file is damaged (password "hunter2")'],
    });
    let message = '';
    try {
      createQpdfEngine(module, log).decrypt(new Uint8Array(), 'hunter2');
    } catch (error) {
      message = error instanceof Error ? error.message + (error as ToolError).hint : '';
    }
    expect(message).not.toContain('hunter2');
    expect(message).toContain('[password]');
  });

  it('reports an empty output as a failure', () => {
    const module = fakeModule({ output: new Uint8Array() });
    expect(() => createQpdfEngine(module, log).decrypt(new Uint8Array(), 'pw')).toThrow(
      /empty file/,
    );
  });
});

describe('unlockedFilename', () => {
  it('renames a .pdf to -unlocked.pdf', () => {
    expect(unlockedFilename('report.pdf')).toBe('report-unlocked.pdf');
  });

  it('handles a name with no .pdf extension', () => {
    expect(unlockedFilename('scanned')).toBe('scanned-unlocked.pdf');
  });

  it('is case-insensitive about the extension', () => {
    expect(unlockedFilename('REPORT.PDF')).toBe('REPORT-unlocked.pdf');
  });
});

describe('withStderrCapture', () => {
  it('captures console.warn into the log', async () => {
    const captured: QpdfLog = { stderr: [] };
    await withStderrCapture(captured, async () => {
      console.warn('one', 'two');
    });
    expect(captured.stderr).toEqual(['one two']);
  });
});
