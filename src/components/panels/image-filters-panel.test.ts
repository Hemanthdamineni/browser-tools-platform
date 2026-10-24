import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runToolById } from '@/lib/worker/client';
import { compareLabel, mountImageFiltersPanel, previewDimensions } from './image-filters-panel';

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

const runToolByIdMock = vi.mocked(runToolById);

/** Preview contexts by canvas, so reads and writes share one buffer. */
const contexts = new WeakMap<HTMLCanvasElement, FakeContext>();

/** A tiny 2D-context stand-in with a real RGBA backing buffer. */
class FakeContext {
  readonly canvas: HTMLCanvasElement;
  imageSmoothingEnabled = true;
  private buffer: Uint8ClampedArray | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /** The canvas can be resized after mount, so size the buffer on demand. */
  private store(): Uint8ClampedArray {
    const need = Math.max(1, this.canvas.width) * Math.max(1, this.canvas.height) * 4;
    if (!this.buffer || this.buffer.length !== need) this.buffer = new Uint8ClampedArray(need);
    return this.buffer;
  }

  clearRect(): void {
    this.store().fill(0);
  }

  drawImage(source: { width?: number; height?: number; pixels?: Uint8ClampedArray }): void {
    // The panel only ever draws the decoded bitmap at full preview scale.
    const dest = this.store();
    if (source.pixels) dest.set(source.pixels.subarray(0, dest.length));
    else dest.fill(0);
  }

  createImageData(width: number, height: number): ImageData {
    // Test double for the DOM type: only `data`/`width`/`height` are ever read.
    const image = { data: new Uint8ClampedArray(width * height * 4), width, height };
    return image as unknown as ImageData;
  }

  getImageData(_x: number, _y: number, width: number, height: number): ImageData {
    const source = this.store();
    const data = new Uint8ClampedArray(Math.max(0, width) * Math.max(0, height) * 4);
    data.set(source.subarray(0, data.length));
    // Same double as above — the panel only reads `data`.
    const image = { data, width, height };
    return image as unknown as ImageData;
  }

  putImageData(image: ImageData, _x: number, _y: number): void {
    this.store().set(image.data.subarray(0, this.store().length));
  }

  readPixels(): Uint8ClampedArray {
    return this.store().slice();
  }
}

/** The markup `image-filters.astro` renders, reduced to the hooks the panel binds to. */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.imageFiltersPanel = '';
  root.dataset.toolId = 'image-filters';
  root.dataset.accept = 'image/png,image/jpeg,image/webp';
  root.dataset.multiple = 'false';
  root.setAttribute('aria-label', 'Image Filters workbench');
  root.innerHTML = `
    <div data-drop role="button" tabindex="0" aria-label="Choose an image or drop it here"></div>
    <ul data-file-list></ul>
    <button type="button" data-example data-example-options='{"grayscale":true}'>Grayscale</button>
    <div data-options>
      <input data-opt-key="brightness" data-opt-type="number" type="range" value="0" min="-100" max="100" aria-label="Brightness" />
      <input data-opt-key="contrast" data-opt-type="number" type="range" value="0" min="-100" max="100" aria-label="Contrast" />
      <input data-opt-key="saturation" data-opt-type="number" type="range" value="0" min="-100" max="100" aria-label="Saturation" />
      <input data-opt-key="grayscale" data-opt-type="boolean" type="checkbox" aria-label="Grayscale" />
      <input data-opt-key="sepia" data-opt-type="boolean" type="checkbox" aria-label="Sepia" />
      <input data-opt-key="sharpen" data-opt-type="number" type="range" value="0" min="0" max="100" aria-label="Sharpen" />
      <select data-opt-key="format" data-opt-type="select" aria-label="Output format">
        <option value="original" selected>Original</option>
        <option value="png">PNG</option>
        <option value="jpeg">JPEG</option>
        <option value="webp">WebP</option>
      </select>
      <input data-opt-key="quality" data-opt-type="number" type="range" value="92" min="10" max="100" aria-label="Quality" />
    </div>
    <div data-preview-wrap hidden>
      <button type="button" data-compare disabled aria-pressed="false">Compare with the original</button>
      <button type="button" data-reset-filters>Reset filters</button>
      <canvas data-preview-canvas width="4" height="4"></canvas>
    </div>
    <p data-preview-status role="status" aria-live="polite"></p>
    <button type="button" data-run disabled>Export</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg aria-live="polite"></p></div>
    <div data-error role="alert" hidden></div>
    <div data-result-wrap hidden>
      <ul data-outputs></ul>
      <ul data-notes></ul>
    </div>
  `;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-preview-canvas]')!;
  contexts.set(canvas, new FakeContext(canvas));
  // jsdom has no canvas backend, so the element is handed a pixel-backed fake.
  const fakeGetContext = () => contexts.get(canvas);
  Object.defineProperty(canvas, 'getContext', { value: fakeGetContext, configurable: true });
  document.body.append(root);
  return root;
}

/** The preview pixels the panel last drew. */
function preview(root: HTMLElement): Uint8ClampedArray {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-preview-canvas]')!;
  return contexts.get(canvas)!.readPixels();
}

/** The RGBA of the preview's top-left pixel. */
function topLeft(root: HTMLElement): number[] {
  const p = preview(root);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0];
}

/** A 4×4 mid-grey image: every pixel (128,128,128,255). */
function greyPixels(): Uint8ClampedArray {
  const p = new Uint8ClampedArray(16 * 4);
  for (let i = 0; i < p.length; i += 4) {
    p[i] = 128;
    p[i + 1] = 128;
    p[i + 2] = 128;
    p[i + 3] = 255;
  }
  return p;
}

const png = (name = 'photo.png') =>
  new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

async function chooseFile(
  root: HTMLElement,
  file: File,
  options: { expectPreview?: boolean } = {},
): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-file-list]')!.textContent).toContain(file.name);
  });
  if (options.expectPreview === false) return;
  await vi.waitFor(() => {
    expect(root.querySelector<HTMLElement>('[data-preview-wrap]')!.hidden).toBe(false);
  });
}

function setRange(root: HTMLElement, key: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(`[data-opt-key="${key}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 4, height: 4, pixels: greyPixels(), close: () => {} })),
  );
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('previewDimensions', () => {
  it('keeps small images at full size', () => {
    expect(previewDimensions(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
  });

  it('caps large images to the preview pixel budget', () => {
    const size = previewDimensions(6000, 4000);
    expect(size.width).toBeLessThan(6000);
    expect(size.width * size.height).toBeLessThan(2_100_000);
  });
});

describe('compareLabel', () => {
  it('describes the action the click will take', () => {
    expect(compareLabel(false)).toBe('Compare with the original');
    expect(compareLabel(true)).toBe('Show the edited image');
  });
});

describe('mountImageFiltersPanel', () => {
  it('renders a live, filtered preview from the real pixels', async () => {
    const root = fixture();
    mountImageFiltersPanel(root);
    await chooseFile(root, png());
    // Neutral settings → the preview is the untouched source.
    expect(topLeft(root)).toEqual([128, 128, 128, 255]);

    setRange(root, 'brightness', '20');
    await vi.waitFor(() => {
      expect(root.querySelector('[data-preview-status]')!.textContent).toMatch(/Brightness \+20/);
    });
    // Mid-grey + 20 × 2.55 = 179 — the exact value the export produces.
    expect(topLeft(root)).toEqual([179, 179, 179, 255]);
  });

  it('compare toggles between the original and the filtered image', async () => {
    const root = fixture();
    mountImageFiltersPanel(root);
    await chooseFile(root, png());
    setRange(root, 'brightness', '20');
    await vi.waitFor(() => expect(topLeft(root)).toEqual([179, 179, 179, 255]));

    const compare = root.querySelector<HTMLButtonElement>('[data-compare]')!;
    compare.click();
    expect(topLeft(root)).toEqual([128, 128, 128, 255]);
    expect(root.querySelector('[data-preview-status]')!.textContent).toMatch(/original/i);
    expect(compare.getAttribute('aria-pressed')).toBe('true');
    expect(compare.textContent).toBe('Show the edited image');

    compare.click();
    expect(topLeft(root)).toEqual([179, 179, 179, 255]);
    expect(compare.getAttribute('aria-pressed')).toBe('false');
  });

  it('reset filters restores the neutral defaults', async () => {
    const root = fixture();
    mountImageFiltersPanel(root);
    await chooseFile(root, png());
    setRange(root, 'brightness', '40');
    await vi.waitFor(() => expect(topLeft(root)).toEqual([230, 230, 230, 255]));

    root.querySelector<HTMLButtonElement>('[data-reset-filters]')!.click();
    expect(root.querySelector<HTMLInputElement>('[data-opt-key="brightness"]')!.value).toBe('0');
    expect(topLeft(root)).toEqual([128, 128, 128, 255]);
    expect(root.querySelector('[data-preview-status]')!.textContent).toMatch(/Filters reset/);
  });

  it('a preset example fills the controls and re-renders', async () => {
    const root = fixture();
    mountImageFiltersPanel(root);
    await chooseFile(root, png());
    root.querySelector<HTMLButtonElement>('[data-example]')!.click();
    expect(root.querySelector<HTMLInputElement>('[data-opt-key="grayscale"]')!.checked).toBe(true);
    // Mid-grey is already grey, so the pixels stay the same.
    expect(topLeft(root)).toEqual([128, 128, 128, 255]);
  });

  it('runs the tool through the worker with the current options', async () => {
    const root = fixture();
    mountImageFiltersPanel(root);
    await chooseFile(root, png());
    const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
    expect(runBtn.disabled).toBe(false);
    runBtn.click();
    await vi.waitFor(() => expect(runToolByIdMock).toHaveBeenCalled());
    const [toolId, payload] = runToolByIdMock.mock.calls.at(-1)!;
    expect(toolId).toBe('image-filters');
    expect(payload.files).toHaveLength(1);
    expect(payload.options).toMatchObject({ brightness: 0, format: 'original', grayscale: false });
  });

  it('shows the exported output with a save button and notes', async () => {
    const root = fixture();
    mountImageFiltersPanel(root);
    await chooseFile(root, png());
    runToolByIdMock.mockResolvedValueOnce({
      outputs: [{ filename: 'photo-filtered.png', blob: new Blob([new Uint8Array(4)]) }],
      notes: ['Filter is baked in.'],
    });
    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(false);
    });
    expect(root.querySelector('[data-outputs]')!.textContent).toContain('photo-filtered.png');
    expect(root.querySelector('[data-outputs] button')!.textContent).toBe('Save');
    expect(root.querySelector('[data-notes]')!.textContent).toContain('Filter is baked in.');
  });

  it('reset clears the file, options and results', async () => {
    const root = fixture();
    mountImageFiltersPanel(root);
    await chooseFile(root, png('photo.webp'));
    const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
    expect(runBtn.disabled).toBe(false);

    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    expect(root.querySelector<HTMLElement>('[data-preview-wrap]')!.hidden).toBe(true);
    expect(root.querySelector('[data-file-list]')!.textContent).toBe('');
    expect(runBtn.disabled).toBe(true);
  });

  it('reports a friendly error when the image cannot be decoded', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed');
      }),
    );
    const root = fixture();
    mountImageFiltersPanel(root);
    await chooseFile(root, png(), { expectPreview: false });
    const error = root.querySelector<HTMLElement>('[data-error]')!;
    await vi.waitFor(() => expect(error.hidden).toBe(false));
    expect(error.textContent).toMatch(/could not be opened/i);
  });
});
