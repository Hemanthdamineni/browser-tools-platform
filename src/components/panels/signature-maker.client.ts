/**
 * Signature Maker panel.
 *
 * Loaded on demand by `signature-maker.astro` so no signature code ships to
 * pages that don't use it.
 *
 * The panel owns the drawing pad and typed-name preview, hands the collected
 * payload to the tool's own `run()` (through `runToolById`), and renders the
 * transparent SVG/PNG result. Everything is local: nothing is uploaded.
 */
import { runToolById } from '@/lib/worker/client';
import type { TextRunResult, TextRunInput } from '@/lib/types';
import {
  clearError,
  renderTextResult,
  showError,
  readOptions,
  applyShowWhen,
  imageToPngBlob,
} from '../workbench/shared';
import { get2d, cropToInk } from '@/lib/signature/canvas';
import { PAD_WIDTH, PAD_HEIGHT } from '@/lib/signature/draw';
import { smoothStroke } from '@/tools/generators/signature-maker.core';

/** A 2D point in backing-store space. */
interface Point {
  x: number;
  y:  number;
}

/** A whole signature: one or more ink strokes, each a polyline. */
type Stroke = Point[];

/** Mount the signature maker into a `[data-panel-workbench]` element. */
export function mountSignatureMakerPanel(root: HTMLElement): void {
  // --- DOM refs ---
  const modeSelect = root.querySelector<HTMLSelectElement>('#sig-mode')!;
  const typeWrap = root.querySelector<HTMLElement>('[data-sig-type-wrap]')!;
  const textWrap = root.querySelector<HTMLElement>('[data-sig-text-wrap]')!;
  const textInput = root.querySelector<HTMLInputElement>('#sig-text')!;
  const drawWrap = root.querySelector<HTMLElement>('[data-sig-draw-wrap]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('#sig-canvas')!;
  const formatSelect = root.querySelector<HTMLSelectElement>('#sig-format')!;
  const generateBtn = root.querySelector<HTMLButtonElement>('[data-sig-generate]')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-sig-clear]')!;
  const downloadWrap = root.querySelector<HTMLElement>('[data-sig-download-wrap]')!;
  const downloadLink = root.querySelector<HTMLAnchorElement>('[data-sig-download]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;

  // --- State ---
  let strokes: Stroke[] = [];
  let currentStroke: Point[] = [];
  let drawing = false;
  let currentSvgDataUrl: string | null = null;
  let currentFormat: 'svg' | 'png' = 'svg';
  let abortController: AbortController | null = null;
  let lastColor = '#111827';
  let lastStrokeWidth = 3;

  // --- Canvas setup ---
  function setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Backing store at fixed resolution for crisp export
    canvas.width = PAD_WIDTH;
    canvas.height = PAD_HEIGHT;

    // Display size via CSS
    canvas.style.width = '100%';
    canvas.style.height = '200px';

    const ctx = get2d(canvas);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = lastColor;
    ctx.lineWidth = lastStrokeWidth;
    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
  }

  function getCanvasPoint(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? PAD_WIDTH / rect.width : 1;
    const sy = rect.height > 0 ? PAD_HEIGHT / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * sx,
      y: (event.clientY - rect.top) * sy,
    };
  }

  function redrawCanvas(): void {
    const ctx = get2d(canvas);
    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    ctx.strokeStyle = lastColor;
    ctx.lineWidth = lastStrokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        const p = stroke[0]!;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 0.01, p.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
        for (let i = 1; i < stroke.length; i++) {
          const p = stroke[i]!;
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }

    // Draw current in-progress stroke
    if (currentStroke.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentStroke[0]!.x, currentStroke[0]!.y);
      for (let i = 1; i < currentStroke.length; i++) {
        const p = currentStroke[i]!;
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    drawing = true;
    currentStroke = [getCanvasPoint(event)];
    canvas.setPointerCapture?.(event.pointerId);
    redrawCanvas();
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!drawing) return;
    currentStroke.push(getCanvasPoint(event));
    redrawCanvas();
    event.preventDefault();
  }

  function onPointerUp(event: PointerEvent): void {
    if (!drawing) return;
    drawing = false;
    if (currentStroke.length > 0) {
      // Smooth the stroke
      const smoothed = smoothStroke(currentStroke, 1);
      strokes.push(smoothed);
    }
    currentStroke = [];
    canvas.releasePointerCapture?.(event.pointerId);
    redrawCanvas();
    updateGenerateButton();
  }

  function onPointerCancel(): void {
    if (!drawing) return;
    drawing = false;
    currentStroke = [];
    redrawCanvas();
  }

  function attachCanvasListeners(): void {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerCancel);
  }

  function detachCanvasListeners(): void {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('pointerleave', onPointerCancel);
  }

  // --- Helpers ---
  function updateModeUI(): void {
    const mode = modeSelect.value;
    const isDraw = mode === 'draw';

    typeWrap.hidden = isDraw;
    textWrap.hidden = isDraw;
    drawWrap.hidden = !isDraw;
    clearBtn.hidden = !isDraw;

    applyShowWhen(root);

    if (isDraw) {
      setupCanvas();
      attachCanvasListeners();
    } else {
      detachCanvasListeners();
    }
  }

  function updateGenerateButton(): void {
    const mode = modeSelect.value;
    const hasText = textInput.value.trim() !== '';
    const hasStrokes = strokes.length > 0;

    if (mode === 'type') {
      generateBtn.disabled = !hasText;
    } else {
      generateBtn.disabled = !hasStrokes;
    }
    clearBtn.disabled = !hasStrokes;
  }

  function updateSignaturePadOptions(): void {
    lastColor = (root.querySelector<HTMLSelectElement>('[data-opt-key="color"]')?.value) ?? '#111827';
    lastStrokeWidth = Number((root.querySelector<HTMLInputElement>('[data-opt-key="strokeWidth"]')?.value) ?? 3);
    redrawCanvas();
  }

  function clearAll(): void {
    strokes = [];
    currentStroke = [];
    drawing = false;
    textInput.value = '';
    redrawCanvas();
    updateGenerateButton();
    currentSvgDataUrl = null;
    downloadWrap.hidden = true;
    resultWrap.hidden = true;
    resultWrap.innerHTML = '';
    clearError(errorBox);
  }

  function serializeStrokes(): string {
    return JSON.stringify(strokes.map((stroke) =>
      stroke.map((p) => [Math.round(p.x), Math.round(p.y)])
    ));
  }

  function showResult(result: TextRunResult): void {
    resultWrap.hidden = false;
    resultWrap.innerHTML = '';
    renderTextResult(resultWrap, result);

    // Store the SVG data URL for PNG conversion
    currentSvgDataUrl = result.output;

    // Show download link
    downloadWrap.hidden = false;
    const filename = result.filename || (currentFormat === 'png' ? 'signature.png' : 'signature.svg');
    downloadLink.href = currentSvgDataUrl!;
    downloadLink.download = filename;
    downloadLink.textContent = `Download ${filename}`;

    // Handle PNG format - convert SVG to true PNG via canvas
    if (currentFormat === 'png' && currentSvgDataUrl) {
      generatePngAndUpdateDownload(currentSvgDataUrl);
    }
  }

  async function generatePngAndUpdateDownload(svgDataUrl: string): Promise<void> {
    try {
      downloadLink.textContent = 'Preparing PNG…';
      downloadLink.classList.add('opacity-70', 'cursor-wait');
      generateBtn.disabled = true;

      const pngBlob = await imageToPngBlob(svgDataUrl, 2);
      const pngUrl = URL.createObjectURL(pngBlob);

      // Revoke previous object URL if any
      if (downloadLink.href.startsWith('blob:')) {
        URL.revokeObjectURL(downloadLink.href);
      }

      downloadLink.href = pngUrl;
      downloadLink.download = 'signature.png';
      downloadLink.textContent = 'Download signature.png';
      downloadLink.classList.remove('opacity-70', 'cursor-wait');
    } catch (e) {
      downloadLink.textContent = 'PNG generation failed';
      downloadLink.classList.remove('opacity-70', 'cursor-wait');
      console.error('PNG generation failed:', e);
    } finally {
      generateBtn.disabled = false;
    }
  }

  async function handleGenerate(): Promise<void> {
    clearError(errorBox);
    abortController = new AbortController();

    generateBtn.disabled = true;
    clearBtn.disabled = true;

    try {
      const mode = modeSelect.value;
      const options = readOptions(root);
      currentFormat = formatSelect.value as 'svg' | 'png';

      let payload: TextRunInput;

      if (mode === 'type') {
        const name = textInput.value.trim();
        if (!name) {
          showError(errorBox, 'Type a name first.');
          return;
        }
        payload = { text: name, options };
      } else {
        if (strokes.length === 0) {
          showError(errorBox, 'Draw a signature first.');
          return;
        }
        // Send strokes as JSON string
        payload = { text: serializeStrokes(), options };
      }

      showResult(result);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        showError(errorBox, 'Generation aborted');
      } else if (e instanceof Error) {
        showError(errorBox, e.message);
      } else {
        showError(errorBox, 'Unknown generation error');
      }
    } finally {
      generateBtn.disabled = false;
      clearBtn.disabled = false;
      abortController = null;
    }
  }

  // --- Event listeners ---

  // Mode change
  modeSelect.addEventListener('change', () => {
    updateModeUI();
    clearAll();
  });

  // Format change
  formatSelect.addEventListener('change', () => {
    currentFormat = formatSelect.value as 'svg' | 'png';
    // If we already have a result, update download link
    if (currentSvgDataUrl && currentFormat === 'png') {
      generatePngAndUpdateDownload(currentSvgDataUrl);
    } else if (currentSvgDataUrl && currentFormat === 'svg') {
      if (downloadLink.href.startsWith('blob:')) {
        URL.revokeObjectURL(downloadLink.href);
      }
      downloadLink.href = currentSvgDataUrl;
      downloadLink.download = 'signature.svg';
      downloadLink.textContent = 'Download signature.svg';
    }
  });

  // Generate button
  generateBtn.addEventListener('click', handleGenerate);

  // Clear button
  clearBtn.addEventListener('click', clearAll);

  // Text input - enable generate when text entered
  textInput.addEventListener('input', () => {
    updateGenerateButton();
  });

  // Enter key in text input
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  });

  // Options change -> re-apply showWhen and update canvas
  root.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.matches('[data-opt-key]')) {
      applyShowWhen(root);
      if (target.matches('[data-opt-key="color"], [data-opt-key="strokeWidth"]')) {
        updateSignaturePadOptions();
      }
    }
  });

  // --- Initialize ---
  updateModeUI();
  applyShowWhen(root);

  // Initialize canvas if in draw mode
  if (modeSelect.value === 'draw') {
    setupCanvas();
    attachCanvasListeners();
  }
}