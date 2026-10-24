import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runToolById } from '@/lib/worker/client';
import type { FileRunResult } from '@/lib/types';
import { mountImageBlurRedactPanel } from './image-blur-redact.client';

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

const runToolByIdMock = vi.mocked(runToolById);

/**
 * The markup `image-blur-redact.astro` renders, reduced to the hooks the panel
 * binds to. The real component is exercised by the e2e suite; this keeps the
 * interaction (rectangles → JSON, keyboard control, reset) unit-tested.
 */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.imageBlurRedactPanel = '';
  root.dataset.toolId = 'image-blur-redact';
  root.dataset.accept = 'image/png,image/jpeg,image/webp';
  root.dataset.multiple = 'false';
  root.setAttribute('aria-label', 'Blur & Redact Image workbench');
  root.innerHTML = `
    <div data-drop role="button" tabindex="0" aria-label="Choose an image or drop it here"></div>
    <ul data-file-list></ul>
    <div data-stage-wrap hidden>
      <div data-stage>
        <img data-preview alt="" />
        <div data-overlay><div data-marquee hidden></div></div>
      </div>
      <button type="button" data-add-region>Add a region</button>
      <button type="button" data-clear-regions>Clear regions</button>
      <ul data-region-list></ul>
    </div>
    <p data-stage-status role="status" aria-live="polite"></p>
    <div data-options>
      <select data-opt-key="effect" data-opt-type="select" aria-label="Default effect">
        <option value="blur" selected>Blur</option>
        <option value="pixelate">Pixelate (mosaic)</option>
        <option value="black">Black out</option>
      </select>
      <input data-opt-key="radius" data-opt-type="number" type="range" value="8" aria-label="Blur radius" />
      <textarea data-opt-key="regions" data-opt-type="text" aria-label="Redaction regions (JSON)">[]</textarea>
    </div>
    <button type="button" data-run disabled>Redact</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg aria-live="polite"></p></div>
    <div data-error role="alert" hidden></div>
    <div data-result-wrap hidden>
      <div data-report hidden></div>
      <ul data-outputs></ul>
      <ul data-notes></ul>
    </div>
  `;
  document.body.append(root);
  return root;
}

const png = (name = 'photo.png') =>
  new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

/** Hand a file to the panel the way the drop zone does. */
async function chooseFile(root: HTMLElement, file: File, expectStage = true): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-file-list]')!.textContent).toContain(file.name);
  });
  if (!expectStage) return;
  await vi.waitFor(() => {
    expect(root.querySelector<HTMLElement>('[data-stage-wrap]')!.hidden).toBe(false);
  });
}

/** The rectangles currently stored in the options field. */
function fieldRegions(root: HTMLElement): { x: number; y: number; w: number; h: number; effect?: string }[] {
  return JSON.parse(root.querySelector<HTMLTextAreaElement>('[data-opt-key="regions"]')!.value);
}

/** The overlay boxes, topmost last. */
function boxes(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-overlay] [data-region]')];
}

/** Press a key on the currently focused region box. */
function press(root: HTMLElement, key: string, options: KeyboardEventInit = {}): void {
  const box = boxes(root).at(-1)!;
  box.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
}

function addRegion(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>('[data-add-region]')!.click();
}

beforeEach(() => {
  // jsdom has no blob URLs and never decodes an <img>, so stand in for both.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get: () => 640,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
    configurable: true,
    get: () => 480,
  });
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('mountImageBlurRedactPanel', () => {
  it('adds a keyboard-reachable rectangle and mirrors it into the options field', () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);

    addRegion(root);

    expect(fieldRegions(root)).toEqual([{ x: 30, y: 40, w: 40, h: 20 }]);
    const box = boxes(root)[0]!;
    expect(box.getAttribute('role')).toBe('button');
    expect(box.tabIndex).toBe(0);
    expect(box.getAttribute('aria-pressed')).toBe('true');
    expect(box.style.left).toBe('30%');
    expect(box.style.width).toBe('40%');
    expect(box.getAttribute('aria-label')).toMatch(/Region 1, Blur, x 30%, y 40%/);
  });

  it('moves a selected rectangle with the arrow keys, in small and large steps', () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    addRegion(root);

    press(root, 'ArrowRight');
    expect(fieldRegions(root)[0]!.x).toBe(31);
    press(root, 'ArrowDown', { shiftKey: true });
    expect(fieldRegions(root)[0]!.y).toBe(45);
    press(root, 'ArrowLeft', { shiftKey: true });
    press(root, 'ArrowUp');
    expect(fieldRegions(root)[0]).toMatchObject({ x: 26, y: 44 });
  });

  it('resizes a selected rectangle with + and -, and never past the image edge', () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    addRegion(root);

    press(root, '+');
    expect(fieldRegions(root)[0]).toMatchObject({ w: 41, h: 21 });
    press(root, '-');
    press(root, '-');
    expect(fieldRegions(root)[0]).toMatchObject({ w: 39, h: 19 });
    for (let i = 0; i < 60; i++) press(root, '+', { shiftKey: true });
    // The rectangle stays fully inside the image.
    const region = fieldRegions(root)[0]!;
    expect(region.x + region.w).toBeLessThanOrEqual(100);
    expect(region.y + region.h).toBeLessThanOrEqual(100);
  });

  it('deletes a rectangle with Delete and with Backspace', () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    addRegion(root);
    addRegion(root);
    expect(boxes(root)).toHaveLength(2);

    press(root, 'Delete');
    expect(fieldRegions(root)).toHaveLength(1);
    expect(boxes(root)).toHaveLength(1);

    press(root, 'Backspace');
    expect(fieldRegions(root)).toEqual([]);
    expect(boxes(root)).toHaveLength(0);
    expect(root.querySelector('[data-stage-status]')!.textContent).toMatch(/drag on the image/i);
  });

  it('reads a hand-edited region list and reports invalid JSON', () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    const field = root.querySelector<HTMLTextAreaElement>('[data-opt-key="regions"]')!;

    field.value = '[{"x":10,"y":20,"w":30,"h":40,"effect":"black"},{"x":60,"y":60,"w":10,"h":10}]';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(boxes(root)).toHaveLength(2);
    expect(boxes(root)[1]!.getAttribute('aria-label')).toMatch(/x 60%, y 60%/);

    field.value = '[{';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('[data-stage-status]')!.textContent).toMatch(/not valid JSON/i);
    // The last good rectangles stay on screen while the field is broken.
    expect(boxes(root)).toHaveLength(2);
  });

  it('edits a rectangle through the region list fields and effect override', () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    addRegion(root);

    const xField = root.querySelector<HTMLInputElement>('[data-region-field="x"]')!;
    xField.value = '12';
    xField.dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldRegions(root)[0]!.x).toBe(12);

    const effect = root.querySelector<HTMLSelectElement>('[data-region-effect]')!;
    effect.value = 'black';
    effect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldRegions(root)[0]!.effect).toBe('black');

    // The region list is re-rendered on every change, so re-query the select.
    const cleared = root.querySelector<HTMLSelectElement>('[data-region-effect]')!;
    expect(cleared.value).toBe('black');
    cleared.value = '';
    cleared.dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldRegions(root)[0]!.effect).toBeUndefined();
  });

  it('clears every rectangle with the clear button', () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    addRegion(root);

    root.querySelector<HTMLButtonElement>('[data-clear-regions]')!.click();

    expect(fieldRegions(root)).toEqual([]);
    expect(boxes(root)).toHaveLength(0);
  });

  it('chooses an image, enables Run and refuses to run with no rectangles', async () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    await chooseFile(root, png('holiday.png'));

    const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
    expect(runBtn.disabled).toBe(false);
    expect(root.querySelector('[data-stage-status]')!.textContent).toMatch(/640 × 480/);

    runBtn.click();

    const error = root.querySelector<HTMLElement>('[data-error]')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/nothing to redact/i);
    expect(runToolByIdMock).not.toHaveBeenCalled();
  });

  it('sends the rectangles and options to the tool and renders the output', async () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    await chooseFile(root, png('holiday.png'));
    addRegion(root);
    press(root, '+');
    root.querySelector<HTMLSelectElement>('[data-opt-key="effect"]')!.value = 'pixelate';
    root.querySelector<HTMLInputElement>('[data-opt-key="radius"]')!.value = '24';

    runToolByIdMock.mockResolvedValue({
      outputs: [
        {
          filename: 'holiday-redacted.png',
          blob: new Blob(['x'], { type: 'image/png' }),
        },
      ],
      report: {
        output: JSON.stringify({ headers: ['Region'], rows: [['1']] }),
        render: 'table',
      },
      notes: ['EXIF, GPS, XMP, IPTC, the ICC colour profile and comments were dropped.'],
      stats: { regions: 1 },
    } satisfies FileRunResult);

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(false);
    });

    expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    const [toolId, recordedPayload, runOptions] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('image-blur-redact');
    // `runToolById` is generic over its payload, so narrow the recorded call once.
    const { files, options } = recordedPayload as { files: File[]; options: Record<string, unknown> };
    expect(JSON.parse(String(options.regions))).toEqual([{ x: 30, y: 40, w: 41, h: 21 }]);
    expect(options.effect).toBe('pixelate');
    expect(options.radius).toBe(24);
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe('holiday.png');

    expect(root.querySelector('[data-outputs]')!.textContent).toContain('holiday-redacted.png');
    expect(root.querySelector('[data-report]')!.textContent).toContain('Region');
    expect(root.querySelector('[data-notes]')!.textContent).toMatch(/EXIF, GPS, XMP/);
    expect(runOptions?.signal).toBeInstanceOf(AbortSignal);
  });

  it('surfaces a tool error without publishing a result', async () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    await chooseFile(root, png());
    addRegion(root);
    runToolByIdMock.mockRejectedValue(
      Object.assign(new Error('Nothing to redact.'), { hint: 'Draw at least one rectangle.' }),
    );

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
    });

    expect(root.querySelector('[data-error]')!.textContent).toContain('Draw at least one rectangle.');
    expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(true);
  });

  it('resets the whole panel: file, rectangles, results and button state', async () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    await chooseFile(root, png());
    addRegion(root);
    runToolByIdMock.mockResolvedValue({
      outputs: [{ filename: 'photo-redacted.png', blob: new Blob(['x'], { type: 'image/png' }) }],
    });
    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(false);
    });

    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-file-list]')!.childElementCount).toBe(0);
    });

    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-progress-wrap]')!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-stage-wrap]')!.hidden).toBe(true);
    expect(fieldRegions(root)).toEqual([]);
    expect(boxes(root)).toHaveLength(0);
  });

  it('reports a file that cannot be shown as an image instead of running', async () => {
    const root = fixture();
    mountImageBlurRedactPanel(root);
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.reject(new Error('decode failed')),
    });

    await chooseFile(root, new File(['nope'], 'broken.png', { type: 'image/png' }), false);

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
    });
    expect(root.querySelector<HTMLElement>('[data-error]')!.textContent).toMatch(/could not be shown/i);
    expect(root.querySelector<HTMLElement>('[data-stage-wrap]')!.hidden).toBe(true);
  });
});
