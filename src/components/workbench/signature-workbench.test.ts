import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountSignatureWorkbench } from './signature-workbench';
import { SIGNATURE_CHANGE_EVENT, type SignatureAsset } from '@/lib/signature/types';
import { installCanvasMock, type CanvasMockHandle } from '../../../test/signature-fakes';
import { runToolById } from '@/lib/worker/client';

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                      */
/* -------------------------------------------------------------------------- */

const runToolByIdMock = vi.mocked(runToolById);

/** A page preview: 200 × 300 pt, two pages. */
const fakePdf = {
  numPages: 2,
  getPage: async () => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 200 * scale, height: 300 * scale }),
    render: () => ({ promise: Promise.resolve() }),
    cleanup: () => undefined,
  }),
  destroy: async () => undefined,
};

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({ promise: Promise.resolve(fakePdf) }),
}));

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({
  runToolById: vi.fn(),
}));

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The markup SignatureWorkbench.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.fileWorkbench = '';
  root.dataset.signatureWorkbench = '';
  root.dataset.toolId = 'pdf-sign';
  root.innerHTML = `
    <div data-drop></div>
    <ul data-file-list></ul>
    <input type="number" data-page-input value="1" />
    <input type="number" data-placement="x" />
    <input type="number" data-placement="y" />
    <input type="number" data-placement="width" />
    <canvas data-page-canvas></canvas>
    <div data-signature-box tabindex="0" hidden>
      <img data-signature-image alt="" />
      <span data-resize-handle></span>
    </div>
    <p data-preview-status></p>
    <div data-signature-capture></div>
    <button type="button" data-run disabled>Sign</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg></p></div>
    <div data-error hidden></div>
    <div data-result-wrap hidden><ul data-outputs></ul><ul data-notes></ul></div>
  `;
  document.body.append(root);
  return root;
}

/** A file that starts with the `%PDF-` header. */
function pdfFile(name = 'contract.pdf'): File {
  return new File([new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n')], name, {
    type: 'application/pdf',
  });
}

const asset: SignatureAsset = {
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  width: 60,
  height: 30,
  mode: 'draw',
  hasAlpha: true,
};

/** Hand a file to the panel the way the drop zone does. */
async function chooseFile(root: HTMLElement, file: File): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-file-list]')!.textContent).toContain(file.name);
  });
}

/** Announce a signature the way the capture component does. */
function publishSignature(root: HTMLElement): void {
  const capture = root.querySelector<HTMLElement>('[data-signature-capture]')!;
  capture.dispatchEvent(
    new CustomEvent<SignatureAsset | null>(SIGNATURE_CHANGE_EVENT, {
      detail: asset,
      bubbles: true,
    }),
  );
}

let mock: CanvasMockHandle;

beforeEach(() => {
  mock = installCanvasMock();
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] } as never);
});

afterEach(() => {
  mock.restore();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('mountSignatureWorkbench', () => {
  it('refuses a file that is not a PDF and keeps the run button disabled', async () => {
    const root = fixture();
    mountSignatureWorkbench(root);

    await chooseFile(root, new File(['hello'], 'notes.txt', { type: 'text/plain' }));

    const error = root.querySelector<HTMLElement>('[data-error]')!;
    await vi.waitFor(() => {
      expect(error.hidden).toBe(false);
    });
    expect(error.textContent).toMatch(/not a PDF/);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-preview-status]')!.textContent).toMatch(
      /not a PDF/,
    );
  });

  it('previews the chosen page and enables signing once a signature exists', async () => {
    const root = fixture();
    mountSignatureWorkbench(root);

    await chooseFile(root, pdfFile());
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-preview-status]')!.textContent).toMatch(
        /Page 1 of 2/,
      );
    });
    // No signature yet — nothing to sign with.
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);

    publishSignature(root);

    const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
    expect(runBtn.disabled).toBe(false);
    const box = root.querySelector<HTMLElement>('[data-signature-box]')!;
    expect(box.hidden).toBe(false);
    expect(
      root.querySelector<HTMLImageElement>('[data-signature-image]')!.getAttribute('src'),
    ).toBe(asset.dataUrl);
  });

  it('enables signing when the signature was created before the file was chosen', async () => {
    const root = fixture();
    mountSignatureWorkbench(root);

    // The user signs first…
    publishSignature(root);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);

    // …and picks the PDF afterwards.
    await chooseFile(root, pdfFile());
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-preview-status]')!.textContent).toMatch(
        /Page 1 of 2/,
      );
    });
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
  });

  it('moves the signature with the keyboard and signs with the placement', async () => {
    const root = fixture();
    mountSignatureWorkbench(root);
    await chooseFile(root, pdfFile());
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-preview-status]')!.textContent).toMatch(
        /Page 1 of 2/,
      );
    });
    publishSignature(root);

    const xInput = root.querySelector<HTMLInputElement>('[data-placement="x"]')!;
    const yInput = root.querySelector<HTMLInputElement>('[data-placement="y"]')!;
    const widthInput = root.querySelector<HTMLInputElement>('[data-placement="width"]')!;

    // The default placement sits one inch from the left, one inch from the
    // bottom, 70 pt wide (a third of the 200 pt page) and 35 pt tall.
    expect(xInput.value).toBe('72');
    expect(yInput.value).toBe('193');
    expect(widthInput.value).toBe('70');

    const box = root.querySelector<HTMLElement>('[data-signature-box]')!;
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(xInput.value).toBe('73');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(yInput.value).toBe('194');
    // Shift moves in bigger steps.
    box.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
    );
    expect(xInput.value).toBe('83');

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    });

    const [toolId, payload] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('pdf-sign');
    expect(payload.options).toEqual({
      page: 1,
      x: 83,
      y: 194,
      width: 70,
      signature: asset.dataUrl,
    });
    expect(payload.files).toHaveLength(1);
  });

  it('resizes the signature from the width field and keeps the aspect ratio', async () => {
    const root = fixture();
    mountSignatureWorkbench(root);
    await chooseFile(root, pdfFile());
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-preview-status]')!.textContent).toMatch(
        /Page 1 of 2/,
      );
    });
    publishSignature(root);

    const widthInput = root.querySelector<HTMLInputElement>('[data-placement="width"]')!;
    widthInput.value = '100';
    widthInput.dispatchEvent(new Event('input', { bubbles: true }));

    // 100 pt wide at the signature's own 2:1 ratio → 50 pt tall.
    expect(widthInput.value).toBe('100');
    expect(root.querySelector<HTMLInputElement>('[data-placement="y"]')!.value).toBe('178');
  });

  it('shows the error the tool reported and never shows a result', async () => {
    runToolByIdMock.mockRejectedValue(
      Object.assign(new Error('This PDF is password-protected — unlock it first.'), {
        name: 'Error',
        hint: 'Encrypted documents have to be unlocked first.',
      }),
    );

    const root = fixture();
    mountSignatureWorkbench(root);
    await chooseFile(root, pdfFile());
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-preview-status]')!.textContent).toMatch(
        /Page 1 of 2/,
      );
    });
    publishSignature(root);

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      const error = root.querySelector<HTMLElement>('[data-error]')!;
      expect(error.hidden).toBe(false);
      expect(error.textContent).toMatch(/password-protected/);
      expect(error.textContent).toMatch(/unlocked first/);
    });
    expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(true);
  });

  it('clears everything on reset', async () => {
    const root = fixture();
    mountSignatureWorkbench(root);
    await chooseFile(root, pdfFile());
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-preview-status]')!.textContent).toMatch(
        /Page 1 of 2/,
      );
    });
    publishSignature(root);

    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLUListElement>('[data-file-list]')!.children).toHaveLength(0);
    });
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-signature-box]')!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(true);
  });
});
