/**
 * Signature pad for file tools that need a drawn, typed or uploaded signature.
 *
 * This module is the only DOM-aware part of `pdf-sign`: it renders the signature
 * to a transparent PNG data URL and writes it into the tool's `signatureImage`
 * option, which the (pure) tool then embeds and flattens with pdf-lib. Nothing
 * here talks to the network.
 */

type Mode = 'draw' | 'type' | 'upload';

interface Point {
  x: number;
  y: number;
}

const DISPLAY_WIDTH = 640;
const DISPLAY_HEIGHT = 220;
const MAX_UPLOAD_WIDTH = 1200;
const TRIM_ALPHA = 8;
const TRIM_PADDING = 4;

function findOption(toolId: string, key: string): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(
    `[data-file-workbench][data-tool-id="${toolId}"] [data-opt-key="${key}"]`,
  );
}

function context2d(canvas: HTMLCanvasElement, read = false): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', read ? { willReadFrequently: true } : undefined);
}

/** Crop a canvas to the bounding box of its non-transparent pixels. */
function trim(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = context2d(source, true);
  if (!ctx) return null;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > TRIM_ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const left = Math.max(0, minX - TRIM_PADDING);
  const top = Math.max(0, minY - TRIM_PADDING);
  const right = Math.min(width - 1, maxX + TRIM_PADDING);
  const bottom = Math.min(height - 1, maxY + TRIM_PADDING);
  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  const outCtx = context2d(out);
  if (!outCtx) return null;
  outCtx.drawImage(source, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function fontString(family: string, size: number): string {
  return `italic ${size}px ${family}`;
}

export function mountSignaturePad(root: HTMLElement): void {
  const toolId = root.dataset.toolId ?? '';
  const optionKey = root.dataset.targetOption ?? 'signatureImage';
  const canvas = root.querySelector<HTMLCanvasElement>('[data-signature-canvas]');
  const option = findOption(toolId, optionKey);
  if (!canvas || !option) return;

  const ctx = context2d(canvas);
  if (!ctx) return;
  canvas.width = DISPLAY_WIDTH;
  canvas.height = DISPLAY_HEIGHT;

  const modeInputs = Array.from(root.querySelectorAll<HTMLInputElement>('[data-signature-mode]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-signature-panel]'));
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-signature-clear]');
  const penColor = root.querySelector<HTMLSelectElement>('[data-signature-pen-color]');
  const penWidth = root.querySelector<HTMLInputElement>('[data-signature-pen-width]');
  const penWidthOut = root.querySelector<HTMLOutputElement>('[data-signature-pen-width-out]');
  const textInput = root.querySelector<HTMLInputElement>('[data-signature-text]');
  const fontSelect = root.querySelector<HTMLSelectElement>('[data-signature-font]');
  const sizeInput = root.querySelector<HTMLInputElement>('[data-signature-size]');
  const sizeOut = root.querySelector<HTMLOutputElement>('[data-signature-size-out]');
  const inkSelect = root.querySelector<HTMLSelectElement>('[data-signature-ink]');
  const fileInput = root.querySelector<HTMLInputElement>('[data-signature-file]');
  const status = root.querySelector<HTMLElement>('[data-signature-status]');
  const errorBox = root.querySelector<HTMLElement>('[data-signature-error]');
  const preview = root.querySelector<HTMLImageElement>('[data-signature-preview]');

  let mode: Mode = 'draw';
  let strokes: Point[][] = [];
  let current: Point[] | null = null;
  let upload: HTMLCanvasElement | null = null;
  let lastUrl = '';

  const setStatus = (message: string) => {
    if (status) status.textContent = message;
  };
  const setError = (message: string) => {
    if (!errorBox) return;
    errorBox.hidden = !message;
    errorBox.textContent = message;
  };

  /** Render the current mode's signature into the display canvas. */
  function redraw(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === 'draw') {
      ctx.strokeStyle = penColor?.value || '#111111';
      ctx.lineWidth = Number(penWidth?.value) || 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const stroke of strokes) {
        ctx.beginPath();
        stroke.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        if (stroke.length === 1) {
          const only = stroke[0]!;
          ctx.lineTo(only.x + 0.01, only.y + 0.01);
        }
        ctx.stroke();
      }
      return;
    }
    if (mode === 'type') {
      const text = textInput?.value.trim() ?? '';
      if (!text) return;
      const family = fontSelect?.value || 'cursive';
      let size = Number(sizeInput?.value) || 64;
      ctx.fillStyle = inkSelect?.value || '#111111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = fontString(family, size);
      const measured = ctx.measureText(text).width;
      const maxWidth = canvas.width - 24;
      if (measured > maxWidth) {
        size = Math.max(12, (size * maxWidth) / measured);
        ctx.font = fontString(family, size);
      }
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      return;
    }
    if (upload) {
      const scale = Math.min(canvas.width / upload.width, canvas.height / upload.height, 1);
      const width = upload.width * scale;
      const height = upload.height * scale;
      ctx.drawImage(
        upload,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
      );
    }
  }

  /** Build the exported transparent PNG for the current mode, or null when blank. */
  function toPng(): HTMLCanvasElement | null {
    if (mode === 'draw') {
      if (!strokes.some((stroke) => stroke.length > 0)) return null;
      const full = document.createElement('canvas');
      full.width = DISPLAY_WIDTH;
      full.height = DISPLAY_HEIGHT;
      const fullCtx = context2d(full);
      if (!fullCtx) return null;
      fullCtx.strokeStyle = penColor?.value || '#111111';
      fullCtx.lineWidth = Number(penWidth?.value) || 2.5;
      fullCtx.lineCap = 'round';
      fullCtx.lineJoin = 'round';
      for (const stroke of strokes) {
        fullCtx.beginPath();
        stroke.forEach((point, index) => {
          if (index === 0) fullCtx.moveTo(point.x, point.y);
          else fullCtx.lineTo(point.x, point.y);
        });
        if (stroke.length === 1) {
          const only = stroke[0]!;
          fullCtx.lineTo(only.x + 0.01, only.y + 0.01);
        }
        fullCtx.stroke();
      }
      return trim(full);
    }
    if (mode === 'type') {
      const text = textInput?.value.trim() ?? '';
      if (!text) return null;
      const family = fontSelect?.value || 'cursive';
      const size = Number(sizeInput?.value) || 64;
      const tight = document.createElement('canvas');
      const measuring = context2d(tight, true);
      if (!measuring) return null;
      measuring.font = fontString(family, size);
      const metrics = measuring.measureText(text);
      const padding = Math.ceil(size * 0.25);
      tight.width = Math.ceil(metrics.width) + padding * 2;
      tight.height = Math.ceil(size * 1.4);
      const drawCtx = context2d(tight, true);
      if (!drawCtx) return null;
      drawCtx.font = fontString(family, size);
      drawCtx.fillStyle = inkSelect?.value || '#111111';
      drawCtx.textAlign = 'left';
      drawCtx.textBaseline = 'middle';
      drawCtx.fillText(text, padding, tight.height / 2);
      return trim(tight);
    }
    return upload ? trim(upload) ?? upload : null;
  }

  /** Push the current signature into the workbench option and refresh the preview. */
  function sync(): void {
    const png = toPng();
    const url = png ? png.toDataURL('image/png') : '';
    if (url !== lastUrl) {
      lastUrl = url;
      option.value = url;
      option.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (preview) {
      if (url) {
        preview.hidden = false;
        preview.src = url;
      } else {
        preview.hidden = true;
        preview.removeAttribute('src');
      }
    }
    setStatus(
      url
        ? 'Signature ready. Set the page and placement below, then press Process.'
        : 'No signature yet — draw, type or upload one.',
    );
  }

  function setMode(next: Mode): void {
    mode = next;
    for (const panel of panels) panel.hidden = panel.dataset.signaturePanel !== next;
    for (const input of modeInputs) input.checked = input.value === next;
    if (clearBtn) {
      clearBtn.hidden = next === 'upload';
      clearBtn.textContent = next === 'type' ? 'Clear text' : 'Clear drawing';
    }
    redraw();
    sync();
  }

  function clearMode(): void {
    if (mode === 'draw') strokes = [];
    else if (mode === 'type' && textInput) textInput.value = '';
    else if (mode === 'upload') {
      upload = null;
      if (fileInput) fileInput.value = '';
    }
    redraw();
    sync();
  }

  function pointFrom(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (mode !== 'draw') return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    current = [pointFrom(event)];
    strokes.push(current);
    redraw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (mode !== 'draw' || !current) return;
    event.preventDefault();
    const coalesced = event.getCoalescedEvents?.() ?? [];
    for (const sample of coalesced.length ? coalesced : [event]) current.push(pointFrom(sample));
    redraw();
  });
  const endStroke = () => {
    if (!current) return;
    current = null;
    sync();
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  canvas.addEventListener('pointerleave', endStroke);

  for (const input of modeInputs) {
    input.addEventListener('change', () => {
      if (input.checked) setMode(input.value as Mode);
    });
  }

  clearBtn?.addEventListener('click', clearMode);
  penColor?.addEventListener('change', () => {
    redraw();
    sync();
  });
  penWidth?.addEventListener('input', () => {
    if (penWidthOut) penWidthOut.value = penWidth.value;
    redraw();
    sync();
  });
  textInput?.addEventListener('input', () => {
    redraw();
    sync();
  });
  fontSelect?.addEventListener('change', () => {
    redraw();
    sync();
  });
  sizeInput?.addEventListener('input', () => {
    if (sizeOut) sizeOut.value = sizeInput.value;
    redraw();
    sync();
  });
  inkSelect?.addEventListener('change', () => {
    redraw();
    sync();
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    setError('');
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      setError('That is not a PNG or JPEG image.');
      fileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError('That file could not be read.');
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => setError('That image could not be decoded.');
      image.onload = () => {
        const scale = Math.min(1, MAX_UPLOAD_WIDTH / image.width);
        const normalized = document.createElement('canvas');
        normalized.width = Math.max(1, Math.round(image.width * scale));
        normalized.height = Math.max(1, Math.round(image.height * scale));
        const normalizedCtx = context2d(normalized);
        if (!normalizedCtx) return;
        normalizedCtx.drawImage(image, 0, 0, normalized.width, normalized.height);
        upload = normalized;
        redraw();
        sync();
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

  if (option.value.trim()) {
    // A signature was supplied without the pad (pasted data URL) — show it as ready.
    lastUrl = option.value;
    setStatus('Signature ready. Set the page and placement below, then press Process.');
    if (preview) {
      preview.hidden = false;
      preview.src = option.value;
    }
  }

  setMode('draw');
}
