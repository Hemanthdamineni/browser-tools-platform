import { describe, expect, it, vi } from 'vitest';
import tool, {
  MAX_OCR_PIXELS,
  SUPPORTED_LANGUAGES,
  assertOcrImageSize,
  cleanOcrText,
  formatConfidence,
  ocrOutputName,
  progressForStatus,
  raceAbort,
  resolveLanguage,
  runOcr,
  type OcrDeps,
  type OcrEngine,
  type OcrEngineResult,
} from './image-ocr.tool';
import type { FileRunInput } from '@/lib/types';

/** A tiny stand-in for a real image file — no decoding ever happens here. */
function imageFile(name = 'scan.png', type = 'image/png'): File {
  return new File(['fake image bytes'], name, { type });
}

function fakeEngine(result: OcrEngineResult) {
  const state = { terminated: 0, recognizeCalls: 0 };
  const engine: OcrEngine = {
    recognize: async () => {
      state.recognizeCalls += 1;
      return result;
    },
    terminate: () => {
      state.terminated += 1;
    },
  };
  return { engine, state };
}

/** Injected deps: fake engine + fake pixel size, so no wasm or canvas is needed. */
function deps(
  engine: OcrEngine,
  measure: () => Promise<{ width: number; height: number }> = async () => ({
    width: 640,
    height: 480,
  }),
): OcrDeps & { loadEngine: ReturnType<typeof vi.fn> } {
  const loadEngine = vi.fn(async () => engine);
  return { loadEngine, measure };
}

function input(overrides: Partial<FileRunInput> = {}): FileRunInput {
  return { files: [imageFile()], options: { language: 'eng' }, ...overrides };
}

describe('image-ocr metadata', () => {
  it('declares the contract the registry and workbench expect', () => {
    expect(tool.meta.id).toBe('image-ocr');
    expect(tool.meta.category).toBe('image');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.accept).toBe('image/*');
    expect(tool.meta.multiple).toBeUndefined();
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });
});

describe('image-ocr pure helpers', () => {
  it('joins lines, strips trailing spaces and collapses blank runs', () => {
    expect(cleanOcrText('one  \r\ntwo\n\n\n\nthree   ')).toBe('one\ntwo\n\nthree');
    expect(cleanOcrText('   \n\n  \t ')).toBe('');
    expect(cleanOcrText('single')).toBe('single');
  });

  it('builds the .txt filename from the source name', () => {
    expect(ocrOutputName('holiday photo.png')).toBe('holiday photo.txt');
    expect(ocrOutputName('screenshot')).toBe('screenshot.txt');
  });

  it('formats confidence only when the engine reports a number', () => {
    expect(formatConfidence(87.6)).toBe('88%');
    expect(formatConfidence(0)).toBe('0%');
    expect(formatConfidence(undefined)).toBeNull();
    expect(formatConfidence(Number.NaN)).toBeNull();
  });

  it('maps tesseract statuses onto overall progress', () => {
    expect(progressForStatus('loading language traineddata', 1)).toEqual({
      fraction: 0.55,
      message: 'Downloading OCR model…',
    });
    expect(progressForStatus('loading language traineddata (from cache)', 0.5)).toEqual({
      fraction: 0.4,
      message: 'Loading saved OCR model…',
    });
    expect(progressForStatus('recognizing text', 1)).toEqual({
      fraction: 1,
      message: 'Reading text…',
    });
    expect(progressForStatus('something else', 0.5)).toBeNull();
    expect(progressForStatus('recognizing text', 5)?.fraction).toBe(1);
  });

  it('accepts vendored languages and rejects the rest', () => {
    expect(SUPPORTED_LANGUAGES).toContain('eng');
    expect(resolveLanguage('deu')).toBe('deu');
    expect(() => resolveLanguage('klingon')).toThrow(/not available/i);
    expect(() => resolveLanguage(undefined)).toThrow(/not available/i);
  });

  it('guards against images above the megapixel budget', () => {
    expect(() => assertOcrImageSize(4000, 4000)).not.toThrow();
    expect(() => assertOcrImageSize(8000, 4000)).toThrow(/too large/i);
    expect(() => assertOcrImageSize(0, 0)).toThrow(/no readable pixel size/i);
    expect(MAX_OCR_PIXELS).toBe(25_000_000);
  });

  it('settles when the wrapped promise wins, and aborts when signalled', async () => {
    await expect(raceAbort(Promise.resolve('done'))).resolves.toBe('done');

    const controller = new AbortController();
    const hanging = new Promise<string>(() => {});
    const raced = raceAbort(hanging, controller.signal);
    controller.abort();
    await expect(raced).rejects.toMatchObject({ name: 'AbortError' });

    controller.abort();
    await expect(raceAbort(Promise.resolve('late'), controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('image-ocr runOcr', () => {
  it('returns the recognised text as a report and a .txt download', async () => {
    const { engine, state } = fakeEngine({ text: 'Hello world\nSecond line', confidence: 87.6 });
    const out = await runOcr(input(), deps(engine));

    expect(out.report).toEqual({ output: 'Hello world\nSecond line', render: 'text' });
    expect(out.outputs).toHaveLength(1);
    expect(out.outputs[0]!.filename).toBe('scan.txt');
    expect(await out.outputs[0]!.blob.text()).toBe('Hello world\nSecond line');
    expect(out.stats).toMatchObject({
      language: 'English',
      pixels: '640 × 480',
      characters: 23,
      confidence: '88%',
    });
    expect(state.recognizeCalls).toBe(1);
    expect(state.terminated).toBe(1);
  });

  it('reports the language label and passes the code to the engine', async () => {
    const { engine } = fakeEngine({ text: 'Hallo' });
    const out = await runOcr(input({ options: { language: 'deu' } }), deps(engine));
    expect(out.stats?.language).toBe('German (Deutsch)');
  });

  it('cleans up multi-line output before handing it back', async () => {
    const { engine } = fakeEngine({ text: 'first   \r\nsecond\n\n\n\nthird  ' });
    const out = await runOcr(input(), deps(engine));
    expect(out.report?.output).toBe('first\nsecond\n\nthird');
  });

  it('handles an empty or whitespace-only result gracefully', async () => {
    const { engine } = fakeEngine({ text: '  \n\n \t ', confidence: 0 });
    const out = await runOcr(input(), deps(engine));
    expect(out.outputs).toEqual([]);
    expect(out.report).toBeUndefined();
    expect(out.warnings?.[0]).toMatch(/no text was detected/i);
    expect(out.stats).toMatchObject({ characters: 0 });
  });

  it('stops very large images before downloading the model', async () => {
    const { engine } = fakeEngine({ text: 'unused' });
    const injected = deps(engine, async () => ({ width: 8000, height: 4000 }));
    await expect(runOcr(input(), injected)).rejects.toThrow(/too large/i);
    expect(injected.loadEngine).not.toHaveBeenCalled();
  });

  it('rejects an unsupported language before touching the engine', async () => {
    const { engine } = fakeEngine({ text: 'unused' });
    const injected = deps(engine);
    await expect(
      runOcr(input({ options: { language: 'klingon' } }), injected),
    ).rejects.toThrow(/not available/i);
    expect(injected.loadEngine).not.toHaveBeenCalled();

    // Same path through the real `run()` — still no engine import.
    await expect(
      tool.run({ files: [imageFile()], options: { language: 'klingon' } }),
    ).rejects.toThrow(/not available/i);
  });

  it('honours an already-aborted signal without loading the engine', async () => {
    const { engine } = fakeEngine({ text: 'unused' });
    const injected = deps(engine);
    const controller = new AbortController();
    controller.abort();
    await expect(
      runOcr(input({ signal: controller.signal }), injected),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(injected.loadEngine).not.toHaveBeenCalled();
  });

  it('terminates the engine when cancelled mid-run', async () => {
    const state = { terminated: 0 };
    let started!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      started = resolve;
    });
    const engine: OcrEngine = {
      recognize: () => {
        started();
        return new Promise(() => {});
      },
      terminate: () => {
        state.terminated += 1;
      },
    };
    const controller = new AbortController();
    const promise = runOcr(
      input({ signal: controller.signal }),
      deps(engine, async () => ({ width: 10, height: 10 })),
    );
    await inFlight;
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.terminated).toBe(1);
  });

  it('rejects empty selections and non-image files with a hint', async () => {
    const { engine } = fakeEngine({ text: 'unused' });
    await expect(runOcr(input({ files: [] }), deps(engine))).rejects.toThrow(/choose an image file/i);

    const notAnImage = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    await expect(runOcr(input({ files: [notAnImage] }), deps(engine))).rejects.toMatchObject({
      name: 'ToolError',
      hint: expect.stringMatching(/PNG/i),
    });
  });
});
