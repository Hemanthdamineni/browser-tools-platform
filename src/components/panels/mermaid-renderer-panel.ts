/**
 * The Mermaid Renderer panel.
 *
 * A split-pane editor: Mermaid source on the left, the rendered SVG in a
 * sandboxed iframe on the right. Everything worth testing lives here as a
 * pure function — the debounce schedule, the SVG serialisation (namespace
 * declaration + viewBox), the PNG rasterise maths (scale), the validation-error
 * extraction and the sandboxed preview document. The `mount` at the bottom
 * only wires those to the page and drives Mermaid's lazy, browser-only render.
 *
 * ## Rendering model
 *
 * The tool's pure `run()` (through `runToolById`) normalises the source and
 * identifies the diagram, so a source that is not a Mermaid diagram is refused
 * with a friendly message. Mermaid then renders *into a DOM document* (it needs
 * a layout pass and a CSSStyleSheet), which only the panel can host. The
 * returned SVG is re-serialised into a self-contained file by `serializeSvg`,
 * which guarantees the namespace declaration and a `viewBox`, then written into
 * a sandboxed `<iframe>` (no `allow-scripts`, no `allow-same-origin`) whose
 * document carries a strict Content-Security-Policy. The exported SVG is that
 * same serialised string; the PNG export rasterises it on a canvas at the
 * chosen scale.
 *
 * ## The preview sandbox
 *
 * The iframe carries no `allow-scripts` and no `allow-same-origin`, so the SVG
 * markup can neither run script nor reach this page nor fetch from the network.
 * The preview document sets `script-src 'none'` and blocks every remote
 * request, so the rendered diagram cannot phone home — the tool's promise of
 * `network: 'none'` holds for the preview too.
 */
import type { TextRunResult } from '@/lib/types';
import type { Mermaid } from 'mermaid';
import { runToolById } from '@/lib/worker/client';
import { downloadBlob, downloadText } from '@/lib/files';
import { exportBaseName } from '@/tools/developer/mermaid-renderer.tool';
import { readOptions, showError, clearError } from '../workbench/shared';

/* -------------------------------------------------------------------------- */
/*  Scheduling                                                                */
/* -------------------------------------------------------------------------- */

/** A debounced scheduler: collapses a burst of edits into one call. */
export interface Debounced<T extends unknown[]> {
  schedule: (...args: T) => void;
  /** Drop a pending call without running it. */
  cancel: () => void;
}

/**
 * Run `fn` at most once per `wait` ms, collapsing a burst of edits (a keystroke
 * a second) into a single re-render. The last scheduled call wins. Exported so
 * the preview's re-render cadence can be tested directly.
 */
export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  wait: number,
): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (...args: T): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, wait);
  };
  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  return { schedule, cancel };
}

/** How long after the last keystroke the preview refreshes (ms). */
export const RENDER_DEBOUNCE_MS = 300;

/** How many pixels a PNG rasterises per SVG pixel at the default zoom. */
export const DEFAULT_PNG_SCALE = 2;

/* -------------------------------------------------------------------------- */
/*  SVG serialisation                                                        */
/* -------------------------------------------------------------------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

export interface SvgSize {
  width: number;
  height: number;
}

/**
 * The intrinsic pixel size of an SVG, read from its root `viewBox`.
 * Returns `null` when the root has no usable viewBox.
 */
export function parseViewBox(svg: string): SvgSize | null {
  const m = /\bviewBox\s*=\s*"([^"]*)"/i.exec(svg);
  if (!m) return null;
  const parts = m[1]!
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { width: Math.max(1, Math.round(parts[2]!)), height: Math.max(1, Math.round(parts[3]!)) };
}

/** A positive integer attribute on the root `<svg>` tag, else `null`. */
function numberAttr(tag: string, name: string): number | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  if (!m) return null;
  const n = Math.round(parseFloat(m[1]!));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Set an attribute on an SVG open tag, preserving the existing attribute list. */
function setAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*"[^"]*"`);
  if (re.test(tag)) return tag.replace(re, `${name}="${value}"`);
  return tag.replace(/\/?>$/, ` ${name}="${value}"`);
}

/**
 * Serialise an SVG string into a self-contained standalone file: guarantee the
 * XML namespace declarations, guarantee a `viewBox` (derived from the root
 * width/height attributes when the diagram left it out), and give the root
 * concrete pixel dimensions from that viewBox so it opens at the right size and
 * rasterises at the right resolution. Mermaid emits `width="100%"`, which a
 * standalone SVG cannot size itself from — the viewBox is the source of truth.
 */
export function serializeSvg(svg: string): string {
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (!open) return svg;

  let tag = open[0];
  const has = (attr: string) => new RegExp(`\\b${attr}\\s*=`).test(tag);

  // 1. Namespaces — Mermaid sets these, but only when the embed mode asks for
  //    xlink, and a hand-authored SVG may set neither.
  if (!has('xmlns')) tag = tag.replace('<svg', `<svg xmlns="${SVG_NS}"`);
  if (!has('xmlns:xlink')) tag = tag.replace('<svg', `<svg xmlns:xlink="${XLINK_NS}"`);

  // 2. A viewBox — derived from width/height when the diagram left it out.
  if (!has('viewBox')) {
    const w = numberAttr(tag, 'width');
    const h = numberAttr(tag, 'height');
    if (w != null && h != null) tag = setAttr(tag, 'viewBox', `0 0 ${w} ${h}`);
  }

  // 3. Concrete pixel size from the viewBox.
  const box = parseViewBox(tag);
  if (box) {
    tag = setAttr(tag, 'width', String(box.width));
    tag = setAttr(tag, 'height', String(box.height));
  }

  return tag + svg.slice(open[0].length);
}

/* -------------------------------------------------------------------------- */
/*  PNG rasterise maths                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The pixel size of the PNG canvas that rasterises an `SvgSize` at a scale
 * factor. Never smaller than 1×1, and the scale is clamped to a sane floor so
 * a stray 0 (or negative) can never produce a zero-size canvas.
 */
export function pngDimensions(size: SvgSize, scale: number): SvgSize {
  const s = Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_PNG_SCALE;
  return {
    width: Math.max(1, Math.round(size.width * s)),
    height: Math.max(1, Math.round(size.height * s)),
  };
}

/** The PNG export scale for a stored option value, clamped to 1–8. */
export function pngScaleOption(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PNG_SCALE;
  return Math.min(8, Math.max(1, Math.round(n)));
}

/**
 * Draw an SVG string onto a canvas and resolve it as a PNG Blob. This is the
 * DOM half of the PNG export — the geometry (`pngDimensions`) is pure, but
 * rasterising needs an `<img>` (SVG must be drawn that way; `createImageBitmap`
 * rejects SVG blobs in Chromium) and a 2D canvas.
 */
export function svgToPngBlob(
  svg: string,
  scale: number,
  canvas?: HTMLCanvasElement,
): Promise<Blob> {
  const { promise, resolve, reject } = Promise.withResolvers<Blob>();
  // A data URL keeps the rasteriser self-contained (no blob URL to revoke) and
  // `encodeURIComponent` survives the non-ASCII text a diagram label can hold.
  const image = new Image();
  image.onload = () => {
    const size = parseViewBox(svg) ?? {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
    const px = pngDimensions(size, scale);
    const cvs = canvas ?? document.createElement('canvas');
    cvs.width = px.width;
    cvs.height = px.height;
    const ctx = cvs.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context is unavailable.'));
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, px.width, px.height);
    cvs.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
      'image/png',
    );
  };
  image.onerror = () => reject(new Error('The SVG could not be rasterised.'));
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return promise;
}

/* -------------------------------------------------------------------------- */
/*  Validation-error extraction                                               */
/* -------------------------------------------------------------------------- */

/**
 * Pull a short, human-readable message out of Mermaid's error shape so it can
 * be shown inline under the editor. Mermaid's parse error carries both a
 * formatted `message` ("Parse error on line 3: …") and a structured `hash` with
 * a zero-indexed `loc.first_line`; a generic `Error` may carry neither. The
 * first line of the message is preferred, with the line number re-derived from
 * the structured hash when the message omits it.
 */
export function extractMermaidError(error: unknown): string {
  if (!error) return 'The diagram could not be parsed.';
  const e = error as { message?: unknown; hash?: { loc?: { first_line?: number } } };
  const message = typeof e.message === 'string' ? e.message : '';

  let line: number | null = null;
  const structured = e.hash?.loc?.first_line;
  if (typeof structured === 'number' && Number.isInteger(structured)) line = structured + 1;
  const fromMessage = /line (\d+)/i.exec(message);
  if (line == null && fromMessage) line = parseInt(fromMessage[1]!, 10);

  let first = (message.split('\n')[0] ?? '').trim().replace(/:\s*$/, '');
  if (!first) first = 'The diagram could not be parsed.';
  if (line != null && !/\blines?\b/i.test(first)) first = `${first} on line ${line}`;
  return first;
}

/* -------------------------------------------------------------------------- */
/*  Preview document                                                         */
/* -------------------------------------------------------------------------- */

export type MermaidTheme = 'light' | 'dark';

/** The panel theme for a stored option value; anything else is `'light'`. */
export function mermaidTheme(value: unknown): MermaidTheme {
  return value === 'dark' ? 'dark' : 'light';
}

/** The Content-Security-Policy of the sandboxed preview: offline by design. */
export const PREVIEW_CSP =
  "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/**
 * The document loaded into the sandboxed iframe: the serialised SVG inside a
 * scrollable stage, scaled to the current zoom, on the theme's background.
 */
export function buildPreviewDocument(svg: string, theme: MermaidTheme, zoom = 1): string {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const bg = theme === 'dark' ? '#0b1322' : '#ffffff';
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`,
    '<style>',
    'html,body{margin:0;padding:0;background:' + bg + '}',
    '.stage{box-sizing:border-box;min-height:100vh;padding:12px;overflow:auto}',
    '.stage>svg{display:block;transform:scale(' + z + ');transform-origin:top left}',
    '</style>',
    '</head>',
    '<body><div class="stage">' + svg + '</div></body>',
    '</html>',
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Mount the Mermaid Renderer panel into a `[data-mermaid-renderer-workbench]`
 * element: wire the source textarea to a debounced, Mermaid-backed re-render
 * into the sandboxed iframe, and connect the theme, zoom, example, and
 * SVG/PNG export controls.
 */
export function mountMermaidRendererPanel(root: HTMLElement): void {
  const input = root.querySelector<HTMLTextAreaElement>('[data-source]');
  const frame = root.querySelector<HTMLIFrameElement>('[data-preview]');
  const statusEl = root.querySelector<HTMLElement>('[data-status]');
  const errorBox = root.querySelector<HTMLElement>('[data-error]');
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]');
  const outputHost = root.querySelector<HTMLElement>('[data-output]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]');
  const runLabel = root.querySelector<HTMLElement>('[data-run-label]');
  const liveBox = root.querySelector<HTMLInputElement>('[data-live]');
  const zoomRange = root.querySelector<HTMLInputElement>('[data-zoom]');
  const zoomReset = root.querySelector<HTMLElement>('[data-zoom-reset]');
  const exportSvgBtn = root.querySelector<HTMLButtonElement>('[data-export-svg]');
  const exportPngBtn = root.querySelector<HTMLButtonElement>('[data-export-png]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear]');
  const optionsRoot = root.querySelector<HTMLElement>('[data-options]') ?? root;

  if (!input || !frame) return;

  const toolId = root.dataset.toolId || 'mermaid-renderer';

  /** The last serialised SVG, so exports always match what is on screen. */
  let lastSvg = '';
  let lastTheme: MermaidTheme = 'light';
  let mermaid: Mermaid | null = null;
  let renderSeq = 0;
  let renderId = 0;

  function toast(message: string): void {
    (window as unknown as { toast?: (m: string) => void }).toast?.(message);
  }

  function currentZoom(): number {
    const v = parseFloat(zoomRange?.value ?? '1');
    return Number.isFinite(v) && v > 0 ? v : 1;
  }

  function showRenderError(message: string, hint?: string): void {
    if (statusEl) statusEl.textContent = 'Not rendered';
    if (errorBox) showError(errorBox, message, hint);
    if (resultWrap) resultWrap.hidden = true;
  }

  /** Paint the last serialised SVG into the sandboxed preview at the current zoom. */
  function refreshPreview(): void {
    if (!lastSvg) return;
    frame!.srcdoc = buildPreviewDocument(lastSvg, lastTheme, currentZoom());
    if (statusEl) statusEl.textContent = `Rendered · ${lastSvg.length} chars of SVG`;
    if (resultWrap) resultWrap.hidden = false;
    if (outputHost) outputHost.textContent = lastSvg;
  }

  async function render(): Promise<void> {
    const seq = ++renderSeq;
    const source = input!.value;

    // A blank canvas is not a syntax error — clear the preview quietly.
    if (!source.trim()) {
      lastSvg = '';
      frame!.srcdoc = '';
      if (resultWrap) resultWrap.hidden = true;
      if (outputHost) outputHost.textContent = '';
      if (statusEl) statusEl.textContent = '';
      if (errorBox) clearError(errorBox);
      return;
    }

    const theme = mermaidTheme(readOptions(optionsRoot).theme);
    if (errorBox) clearError(errorBox);
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.setAttribute('aria-busy', 'true');
    }
    if (runLabel) runLabel.textContent = 'Rendering…';
    if (statusEl) statusEl.textContent = 'Rendering…';

    try {
      // The tool normalises the source and identifies the diagram in pure code,
      // so a source that is not a Mermaid diagram is refused with a friendly
      // message before Mermaid is even loaded.
      const prepared = await runToolById<TextRunResult>(toolId, {
        text: source,
        options: readOptions(optionsRoot),
      });
      if (seq !== renderSeq) return;

      // Loaded on demand: Mermaid is ~1 MB and the editor is useful without it.
      mermaid ??= (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        // Mermaid's own default: sanitises the SVG before it is serialised.
        securityLevel: 'strict',
      });
      const id = `mermaid-render-${++renderId}`;
      const { svg } = await mermaid.render(id, prepared.output);
      // Mermaid leaves a temporary `#d<id> svg#<id>` in the document body.
      document.getElementById(`d${id}`)?.remove();
      if (seq !== renderSeq) return;
      lastSvg = serializeSvg(svg);
      lastTheme = theme;
      refreshPreview();
    } catch (err) {
      if (seq !== renderSeq) return;
      if ((err as Error)?.name === 'AbortError') return;
      const e = err as Error & { hint?: string };
      showRenderError(extractMermaidError(e), e.hint);
    } finally {
      if (seq === renderSeq && runBtn) {
        runBtn.disabled = false;
        runBtn.removeAttribute('aria-busy');
        if (runLabel) runLabel.textContent = 'Render diagram';
      }
    }
  }

  const rerender = debounce(render, RENDER_DEBOUNCE_MS);

  function schedule(): void {
    if (!liveBox?.checked) return;
    rerender.schedule();
  }

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                */
  /* ---------------------------------------------------------------------- */

  runBtn?.addEventListener('click', () => void render());
  input.addEventListener('input', () => schedule());
  optionsRoot.addEventListener('input', () => schedule());
  optionsRoot.addEventListener('change', () => schedule());

  liveBox?.addEventListener('change', () => {
    if (liveBox.checked) rerender.schedule();
  });

  zoomRange?.addEventListener('input', () => refreshPreview());
  zoomReset?.addEventListener('click', () => {
    if (!zoomRange) return;
    zoomRange.value = '1';
    refreshPreview();
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    rerender.cancel();
    lastSvg = '';
    frame.srcdoc = '';
    if (resultWrap) resultWrap.hidden = true;
    if (outputHost) outputHost.textContent = '';
    if (statusEl) statusEl.textContent = '';
    if (errorBox) clearError(errorBox);
  });

  exportSvgBtn?.addEventListener('click', () => {
    if (!lastSvg) return;
    const base = exportBaseName(readOptions(optionsRoot).fileName);
    downloadText(lastSvg, `${base}.svg`, 'image/svg+xml');
    toast('SVG downloaded');
  });

  exportPngBtn?.addEventListener('click', () => {
    if (!lastSvg) return;
    const options = readOptions(optionsRoot);
    const base = exportBaseName(options.fileName);
    void svgToPngBlob(lastSvg, pngScaleOption(options.pngScale))
      .then((blob) => {
        downloadBlob(blob, `${base}.png`);
        toast('PNG downloaded');
      })
      .catch((err: Error) => showRenderError(err.message || 'PNG export failed.'));
  });

  // Example chips carry a JSON payload: `{ input, options }`.
  root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((button) => {
    button.addEventListener('click', () => {
      let payload: { input?: string; options?: Record<string, unknown> } = {};
      try {
        payload = JSON.parse(button.dataset.examplePayload ?? '{}') as typeof payload;
      } catch {
        return;
      }
      input.value = payload.input ?? '';
      for (const [k, v] of Object.entries(payload.options ?? {})) {
        const el = optionsRoot.querySelector<HTMLInputElement | HTMLSelectElement>(
          `[data-opt-key="${k}"]`,
        );
        if (!el) continue;
        if ((el as HTMLInputElement).type === 'checkbox')
          (el as HTMLInputElement).checked = Boolean(v);
        else el.value = String(v);
      }
      rerender.cancel();
      void render();
    });
  });

  // The panel opens with the first example so the preview is never blank.
  if (input.value) void render();
}
