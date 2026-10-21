/**
 * Signature capture UI: draw, type or upload a signature.
 *
 * Loaded on demand by `SignatureCapture.astro`. The component never talks to
 * the network — every signature is produced in this tab and handed to the
 * page through a `signaturechange` event.
 */
import { createSignaturePad, type SignaturePad } from '@/lib/signature/draw';
import { renderTypedSignature } from '@/lib/signature/typed';
import { readUploadedSignature } from '@/lib/signature/upload';
import { SIGNATURE_CHANGE_EVENT, type SignatureAsset } from '@/lib/signature/types';

const MODE_LABEL: Record<SignatureAsset['mode'], string> = {
  draw: 'drawn',
  type: 'typed',
  upload: 'uploaded',
};

/** Announce the current signature in the status line. */
function describeAsset(asset: SignatureAsset | null): string {
  if (!asset) return 'No signature yet.';
  return `Signature ready (${MODE_LABEL[asset.mode]}).`;
}

/** Mount the capture UI into a `[data-signature-capture]` element. */
export function mountSignatureCapture(root: HTMLElement): void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-signature-tab]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-signature-panel]'));
  const status = root.querySelector<HTMLElement>('[data-signature-status]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-signature-canvas]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-signature-clear]');
  const textInput = root.querySelector<HTMLInputElement>('[data-signature-text]');
  const styleSelect = root.querySelector<HTMLSelectElement>('[data-signature-style]');
  const colorSelect = root.querySelector<HTMLSelectElement>('[data-signature-color]');
  const typedPreview = root.querySelector<HTMLImageElement>('[data-signature-typed-preview]');
  const fileInput = root.querySelector<HTMLInputElement>('[data-signature-file]');
  const uploadPreview = root.querySelector<HTMLImageElement>('[data-signature-upload-preview]');

  let asset: SignatureAsset | null = null;
  let pad: SignaturePad | null = null;
  let typedTimer: number | null = null;

  const announce = (message: string) => {
    if (status) status.textContent = message;
  };

  const emit = (next: SignatureAsset | null) => {
    asset = next;
    root.dispatchEvent(
      new CustomEvent<SignatureAsset | null>(SIGNATURE_CHANGE_EVENT, {
        detail: next,
        bubbles: true,
      }),
    );
  };

  /* ---------------------------------------------------------------------- */
  /*  Tabs                                                                   */
  /* ---------------------------------------------------------------------- */

  function selectTab(name: string, focus = false): void {
    for (const tab of tabs) {
      const active = tab.dataset.signatureTab === name;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.signaturePanel !== name;
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab.dataset.signatureTab ?? 'draw'));
  }

  const tablist = root.querySelector<HTMLElement>('[data-signature-tabs]');
  tablist?.addEventListener('keydown', (event) => {
    const current = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabs[next]!.dataset.signatureTab ?? 'draw', true);
  });

  /* ---------------------------------------------------------------------- */
  /*  Draw                                                                   */
  /* ---------------------------------------------------------------------- */

  if (canvas) {
    try {
      pad = createSignaturePad(canvas, {
        onChange: (hasInk) => {
          if (!hasInk) {
            if (asset?.mode === 'draw') {
              emit(null);
              announce('Signature cleared.');
            }
            return;
          }
          const drawn = pad?.toAsset();
          if (!drawn) return;
          emit(drawn);
          announce(describeAsset(drawn));
        },
      });
    } catch {
      announce('This browser cannot open a drawing canvas — use the Type or Upload tab.');
    }
  }

  clearBtn?.addEventListener('click', () => {
    pad?.clear();
    if (asset?.mode === 'draw') {
      emit(null);
      announce('Signature cleared.');
    }
  });

  /* ---------------------------------------------------------------------- */
  /*  Type                                                                   */
  /* ---------------------------------------------------------------------- */

  function renderTyped(): void {
    const text = textInput?.value ?? '';
    if (!text.trim()) {
      if (typedPreview) {
        typedPreview.hidden = true;
        typedPreview.removeAttribute('src');
      }
      if (asset?.mode === 'type') emit(null);
      announce('Type a name to create a signature.');
      return;
    }
    try {
      const typed = renderTypedSignature({
        text,
        style: styleSelect?.value,
        color: colorSelect?.value,
      });
      if (typedPreview) {
        typedPreview.src = typed.dataUrl;
        typedPreview.hidden = false;
      }
      emit(typed);
      announce(describeAsset(typed));
    } catch {
      announce('That name could not be rendered — try a shorter one.');
    }
  }

  function scheduleTyped(): void {
    if (typedTimer !== null) window.clearTimeout(typedTimer);
    typedTimer = window.setTimeout(() => {
      typedTimer = null;
      renderTyped();
    }, 120);
  }

  textInput?.addEventListener('input', scheduleTyped);
  styleSelect?.addEventListener('change', renderTyped);
  colorSelect?.addEventListener('change', renderTyped);

  /* ---------------------------------------------------------------------- */
  /*  Upload                                                                 */
  /* ---------------------------------------------------------------------- */

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    announce('Reading the uploaded image…');
    void readUploadedSignature(file)
      .then((uploaded) => {
        if (uploadPreview) {
          uploadPreview.src = uploaded.dataUrl;
          uploadPreview.hidden = false;
        }
        emit(uploaded);
        announce(
          uploaded.hasAlpha
            ? 'Signature ready (uploaded PNG with transparency).'
            : 'Signature ready (uploaded PNG — it has no transparent background).',
        );
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'That image could not be read.';
        announce(message);
        if (uploadPreview) {
          uploadPreview.hidden = true;
          uploadPreview.removeAttribute('src');
        }
        if (asset?.mode === 'upload') emit(null);
      });
  });
}
