import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountSignatureCapture } from './signature-capture';
import { SIGNATURE_CHANGE_EVENT, type SignatureAsset } from '@/lib/signature/types';
import { installCanvasMock, type CanvasMockHandle } from '../../../test/signature-fakes';

let mock: CanvasMockHandle;

/** A minimal version of the markup SignatureCapture.astro renders. */
function fixture(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <div data-signature-tabs>
      <button type="button" role="tab" data-signature-tab="draw" aria-selected="true">Draw</button>
      <button type="button" role="tab" data-signature-tab="type" aria-selected="false" tabindex="-1">Type</button>
      <button type="button" role="tab" data-signature-tab="upload" aria-selected="false" tabindex="-1">Upload</button>
    </div>
    <div role="tabpanel" data-signature-panel="draw"><canvas data-signature-canvas></canvas>
      <button type="button" data-signature-clear>Clear</button></div>
    <div role="tabpanel" data-signature-panel="type" hidden>
      <input type="text" data-signature-text />
      <select data-signature-style><option value="script">Script</option><option value="classic">Classic</option></select>
      <select data-signature-color><option value="#111827">Black</option></select>
      <img data-signature-typed-preview hidden />
    </div>
    <div role="tabpanel" data-signature-panel="upload" hidden>
      <input type="file" data-signature-file />
      <img data-signature-upload-preview hidden />
    </div>
    <p data-signature-status role="status">No signature yet.</p>
  `;
  document.body.append(root);
  return root;
}

function pointer(type: string, x: number, y: number): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event;
}

beforeEach(() => {
  mock = installCanvasMock();
});

afterEach(() => {
  mock.restore();
  document.body.innerHTML = '';
});

describe('mountSignatureCapture', () => {
  it('switches tabs with the mouse and the arrow keys', () => {
    const root = fixture();
    mountSignatureCapture(root);
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-signature-tab]'));
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-signature-panel]'));

    tabs[1]!.click();
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('false');
    expect(panels[1]!.hidden).toBe(false);
    expect(panels[0]!.hidden).toBe(true);
    expect(tabs[1]!.tabIndex).toBe(0);
    expect(tabs[0]!.tabIndex).toBe(-1);

    const tablist = root.querySelector<HTMLElement>('[data-signature-tabs]')!;
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true');
    expect(panels[2]!.hidden).toBe(false);

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
  });

  it('announces a drawn signature', () => {
    const root = fixture();
    mountSignatureCapture(root);
    const canvas = root.querySelector<HTMLCanvasElement>('[data-signature-canvas]')!;
    const seen: (SignatureAsset | null)[] = [];
    root.addEventListener(SIGNATURE_CHANGE_EVENT, (event) => {
      seen.push((event as CustomEvent<SignatureAsset | null>).detail);
    });

    canvas.dispatchEvent(pointer('pointerdown', 20, 20));
    canvas.dispatchEvent(pointer('pointermove', 120, 60));
    canvas.dispatchEvent(pointer('pointerup', 120, 60));

    expect(seen).toHaveLength(1);
    expect(seen[0]!.mode).toBe('draw');
    expect(seen[0]!.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(root.querySelector('[data-signature-status]')!.textContent).toMatch(/ready \(drawn\)/);
  });

  it('announces a typed signature', async () => {
    const root = fixture();
    mountSignatureCapture(root);
    const input = root.querySelector<HTMLInputElement>('[data-signature-text]')!;
    const seen: (SignatureAsset | null)[] = [];
    root.addEventListener(SIGNATURE_CHANGE_EVENT, (event) => {
      seen.push((event as CustomEvent<SignatureAsset | null>).detail);
    });

    input.value = 'Ada';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(seen).toHaveLength(1);
    expect(seen[0]!.mode).toBe('type');
    expect(seen[0]!.width).toBeGreaterThan(0);
    const preview = root.querySelector<HTMLImageElement>('[data-signature-typed-preview]')!;
    expect(preview.hidden).toBe(false);
    expect(preview.getAttribute('src')).toMatch(/^data:image\/png/);
  });

  it('reports an unsupported upload without breaking', async () => {
    const root = fixture();
    mountSignatureCapture(root);
    const fileInput = root.querySelector<HTMLInputElement>('[data-signature-file]')!;
    const seen: (SignatureAsset | null)[] = [];
    root.addEventListener(SIGNATURE_CHANGE_EVENT, (event) => {
      seen.push((event as CustomEvent<SignatureAsset | null>).detail);
    });

    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'sign.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(fileInput, 'files', { value: [jpeg] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(seen).toHaveLength(0);
    expect(root.querySelector('[data-signature-status]')!.textContent).toMatch(/PNG/);
  });
});
