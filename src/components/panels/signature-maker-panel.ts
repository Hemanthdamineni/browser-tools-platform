/**
 * Signature maker panel.
 *
 * Loaded on demand by `signature-maker.astro`. The panel owns the browser
 * interaction — a pointer-driven drawing pad and a typed-signature form — and
 * turns what the user creates into a transparent PNG or SVG.
 *
 * The pure maths lives here too so it can be unit-tested without a DOM: stroke
 * smoothing from raw pointer samples, the padded bounding box, the typed
 * layout and the SVG serialisation. The tool's `run()` delegates to
 * `renderSignature`, so the panel and the headless tool agree exactly.
 *
 * The signature logic is reused from `@/lib/signature` — the same module
 * `pdf-sign` uses. The typed styles and font stacks come from
 * `./typed` and the data-URL encoder from `./pixels`; both already did what
 * was needed, so `src/lib/**` was left untouched.
 */
import type { OptionValues, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { signatureStyle } from '@/lib/signature/typed';
import type { SignatureStyle } from '@/lib/signature/types';
import { bytesToDataUrl } from '@/lib/signature/pixels';
import { downloadBlob, downloadText } from '@/lib/files';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** A 2D point in pad/backing-store space. */
export interface Point {
  x: number;
  y: number;
}

/** A whole signature: one or more ink strokes, each a polyline. */
export type Stroke = Point[];

/** The padded box a signature occupies. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Options shared by the SVG serialisers. */
export interface SvgBaseOptions {
  /** Ink colour. Any CSS colour. */
  color?: string;
}

/** Options for a drawn signature's SVG. */
export interface StrokeSvgOptions extends SvgBaseOptions {
  /** Stroke width in viewBox units. */
  strokeWidth?: number;
  /** Quiet-zone padding around the ink, in viewBox units. */
  padding?: number;
}

/** Options for a typed signature's SVG. */
export interface TypedSvgOptions extends SvgBaseOptions {
  /** One of the signature styles: script, classic, modern or mono. */
  style?: SignatureStyle | string;
  /** Font size in pixels — the layout follows it. */
  size?: number;
}

/** The measured layout of a typed name. */
export interface TypedLayout {
  /** The CSS font stack, already including the italic prefix when needed. */
  font: string;
  fontSize: number;
  /** Quiet-zone padding baked into the box. */
  padding: number;
  width: number;
  height: number;
  /** Where the text starts on the x axis. */
  textX: number;
  /** Where the text baseline sits on the y axis. */
  baseline: number;
}

/** Quiet-zone padding baked into a drawn signature's export. */
export const DEFAULT_PADDING = 24;
/** The pad's backing-store size — 10:3 keeps a signature sharp at ~2× print. */
export const PAD_WIDTH = 1200;
export const PAD_HEIGHT = 360;

const PRECISION = 2;

const round = (n: number): number => {
  const f = 10 ** PRECISION;
  return Math.round(n * f) / f;
};

/* -------------------------------------------------------------------------- */
/*  Stroke smoothing                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Smooth a raw pointer sample sequence with Chaikin's corner-cutting
 * algorithm. Each pass replaces every inner corner with two points a quarter
 * of the way along its two edges, which rounds the polyline. One pass is
 * enough to take the jitter out of a finger or mouse trace; the endpoints are
 * kept so the stroke begins and ends where the user put it down and lifted it.
 */
export function smoothStroke(samples: Stroke, passes = 1): Stroke {
  if (samples.length < 3) return samples.map((p) => ({ x: p.x, y: p.y }));
  let polyline = samples.map((p) => ({ x: p.x, y: p.y }));
  const count = Math.max(0, Math.floor(passes));
  for (let pass = 0; pass < count; pass++) {
    const n = polyline.length;
    if (n < 3) break;
    const next: Point[] = [polyline[0]!];
    for (let i = 1; i < n; i++) {
      const a = polyline[i - 1]!;
      const b = polyline[i]!;
      next.push({ x: round(0.75 * a.x + 0.25 * b.x), y: round(0.75 * a.y + 0.25 * b.y) });
      next.push({ x: round(0.25 * a.x + 0.75 * b.x), y: round(0.25 * a.y + 0.75 * b.y) });
    }
    next.push(polyline[n - 1]!);
    polyline = next;
  }
  return polyline;
}

/* -------------------------------------------------------------------------- */
/*  Bounding box                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The bounding box of all ink, grown by `padding` on every side. Returns
 * `null` when there are no points at all.
 *
 * The box is geometric: for points spanning x ∈ [0, 20] with `padding = 10`
 * it is `{ x: -10, width: 40 }`, which is exactly what the SVG viewBox needs.
 */
export function signatureBounds(strokes: Stroke[], padding: number): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  const pad = Math.max(0, Number(padding) || 0);
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

/* -------------------------------------------------------------------------- */
/*  SVG serialisation                                                          */
/* -------------------------------------------------------------------------- */

/** Escape text so it can sit inside XML character data or an attribute. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Serialise a typed name into a transparent SVG. The background stays
 * transparent and there are no external references (the font is a system
 * stack). Throws a {@link ToolError} for a blank name.
 */
export function typedToSvg(name: string, options: TypedSvgOptions = {}): string {
  const layout = typedLayout(name, options);
  const color = options.color || '#111827';
  const italic = layout.font.startsWith('italic ') ? ' font-style="italic"' : '';
  const fontStack = layout.font.replace(/^(italic )?/, '').replace(/^\d+px /, '');
  // The stack carries its own single quotes; only a double quote would break
  // the double-quoted XML attribute, so it is replaced.
  const fontFamily = fontStack.replace(/"/g, "'");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">` +
    `<text x="${layout.textX}" y="${layout.baseline}" fill="${color}" font-family="${fontFamily}" font-size="${layout.fontSize}"${italic} text-anchor="start" dominant-baseline="central">${escapeXml(String(name).trim())}</text>` +
    `</svg>`
  );
}

/** The path data for one stroke, shifted by `(-ox, -oy)` to sit at the origin. */
function strokePath(stroke: Stroke, ox: number, oy: number): string {
  // A single point is a tap: a zero-length segment plus `stroke-linecap="round"`
  // paints a dot.
  if (stroke.length === 1) {
    const only = stroke[0]!;
    const x = round(only.x - ox);
    const y = round(only.y - oy);
    return `M ${x} ${y} L ${x} ${y}`;
  }
  const parts: string[] = [];
  for (const point of stroke) {
    const command = parts.length === 0 ? 'M' : 'L';
    parts.push(`${command} ${round(point.x - ox)} ${round(point.y - oy)}`);
  }
  return parts.join(' ');
}

/**
 * Serialise drawn strokes into a transparent SVG. No background element is
 * emitted (so the export is transparent) and there are no external references.
 * Throws a {@link ToolError} when there is no ink to draw.
 */
export function strokesToSvg(strokes: Stroke[], options: StrokeSvgOptions = {}): string {
  const color = options.color || '#111827';
  const strokeWidth = Math.max(0.5, Number(options.strokeWidth) || 3);
  const padding = Number.isFinite(Number(options.padding))
    ? Math.max(0, Number(options.padding))
    : DEFAULT_PADDING;

  const bounds = signatureBounds(strokes, padding);
  if (!bounds) throw new ToolError('Draw a signature first.', 'The pad is empty.');

  const width = Math.max(1, round(bounds.width));
  const height = Math.max(1, round(bounds.height));
  const path = strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => strokePath(stroke, bounds.x, bounds.y))
    .join(' ');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<path d="${path}" fill="none" stroke="${color}" stroke-width="${round(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/**
 * The layout of a typed name: the font stack, the font size and the box the
 * SVG needs. Mirrors the geometry of `renderTypedSignature` (the canvas
 * version), so the SVG and the PNG agree. Throws a {@link ToolError} for a
 * blank name.
 */
export function typedLayout(name: string, options: TypedSvgOptions = {}): TypedLayout {
  const text = String(name ?? '').trim();
  if (!text) throw new ToolError('Type a name first.', 'It cannot be blank.');
  const style = signatureStyle(options.style);
  const fontSize = Math.max(16, Math.min(512, Math.round(Number(options.size) || 180)));
  const padding = Math.ceil(fontSize * 0.3);
  // A fixed half-em advance per character approximates the canvas measurement
  // closely enough for the box; the SVG text is anchored, so it never clips the
  // name even if a glyph is a little wider.
  const advance = fontSize * 0.5;
  const width = Math.max(1, Math.ceil(text.length * advance) + padding * 2);
  const height = Math.max(1, Math.ceil(fontSize * 1.7) + padding * 2);
  return {
    font: `${style.italic ? 'italic ' : ''}${fontSize}px ${style.font}`,
    fontSize,
    padding,
    width,
    height,
    textX: padding,
    baseline: Math.round(height / 2),
  };
}

/** Encode an SVG string as a `data:image/svg+xml;base64` URL for rendering. */
export function svgDataUrl(svg: string): string {
  return bytesToDataUrl('image/svg+xml', new TextEncoder().encode(svg));
}

/**
 * Parse the tool's text payload (draw mode) into an array of strokes. Each
 * stroke is a list of `[x, y]` pairs. Throws a {@link ToolError} for anything
 * that is not that shape.
 */
export function parseStrokes(text: string): Stroke[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ToolError('That signature data is not valid JSON.', 'Export it again from the pad.');
  }
  if (!Array.isArray(raw)) {
    throw new ToolError('The signature data is not a list of strokes.');
  }
  const strokes: Stroke[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry)) throw new ToolError('Each stroke must be a list of points.');
    const stroke: Point[] = [];
    for (const point of entry) {
      if (!Array.isArray(point) || point.length < 2) {
        throw new ToolError('Each point must have x and y coordinates.');
      }
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new ToolError('Point coordinates must be numbers.');
      }
      stroke.push({ x, y });
    }
    if (stroke.length > 0) strokes.push(stroke);
  }
  return strokes;
}

/**
 * Build the tool's text result from a payload. `mode` decides whether `text`
 * is a name (typed) or a JSON stroke list (drawn). Empty input yields the
 * empty result, matching the shared text-tool contract.
 */
export function renderSignature(text: string, options: OptionValues): TextRunResult {
  const payload = String(text ?? '').trim();
  if (!payload) return { output: '' };

  const mode = String(options.mode ?? 'draw');
  const color = String(options.color ?? '#111827');

  if (mode === 'type') {
    const layout = typedLayout(payload, {
      color,
      style: String(options.style ?? 'script'),
      size: Number(options.size) || 180,
    });
    const svg = typedToSvg(payload, {
      color,
      style: String(options.style ?? 'script'),
      size: Number(options.size) || 180,
    });
    return {
      output: svgDataUrl(svg),
      render: 'image',
      filename: 'signature.svg',
      stats: { source: 'typed', width: layout.width, height: layout.height, format: 'SVG' },
      notes: ['The SVG keeps a transparent background and can be scaled to any size.'],
    };
  }

  const strokes = parseStrokes(payload);
  if (!strokes.length) return { output: '' };
  const svg = strokesToSvg(strokes, {
    color,
    strokeWidth: Number(options.strokeWidth) || 3,
    padding: DEFAULT_PADDING,
  });
  return {
    output: svgDataUrl(svg),
    render: 'image',
    filename: 'signature.svg',
    stats: { source: 'drawn', strokes: strokes.length, format: 'SVG' },
    notes: ['The SVG keeps a transparent background — only the ink is exported.'],
  };
}

/* -------------------------------------------------------------------------- */
/*  Browser-only export helpers                                                */
/* -------------------------------------------------------------------------- */

/** Rasterise an SVG data URL into a transparent PNG blob. */
export async function svgToPngBlob(svgUrl: string): Promise<Blob> {
  const { promise, resolve, reject } = Promise.withResolvers<Blob>();
  const image = new Image();
  image.src = svgUrl;
  await image.decode();
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  ctx.drawImage(image, 0, 0);
  canvas.toBlob(
    (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
    'image/png',
  );
  return promise;
}

/** Download a signature in the requested format. */
export async function downloadSignature(svg: string, format: 'svg' | 'png'): Promise<void> {
  if (format === 'svg') {
    downloadText(svg, 'signature.svg', 'image/svg+xml');
    return;
  }
  const blob = await svgToPngBlob(svgDataUrl(svg));
  downloadBlob(blob, 'signature.png');
}

/** Map a pointer event's client coordinates into the pad's backing store. */
export function toPadPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
): Point {
  const sx = rect.width > 0 ? width / rect.width : 1;
  const sy = rect.height > 0 ? height / rect.height : 1;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

/* -------------------------------------------------------------------------- */
/*  The interactive panel                                                      */
/* -------------------------------------------------------------------------- */

/** Paint a list of polylines onto a 2D context, in pad order. */
function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  color: string,
  strokeWidth: number,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
    if (stroke.length === 1) {
      ctx.lineTo(stroke[0]!.x + 0.01, stroke[0]!.y);
    } else {
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
    }
    ctx.stroke();
  }
}

/**
 * Mount the signature maker into a `[data-sm-panel-root]` element.
 *
 * The panel drives two sources — a drawing pad and a typed-name form — and
 * exports whichever is active as a transparent SVG or PNG. Everything is
 * local to the tab.
 */
export function mountSignatureMakerPanel(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-sm-canvas]')!;
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-sm-tab]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-sm-panel]'));
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-sm-clear]');
  const nameInput = root.querySelector<HTMLInputElement>('[data-sm-name]');
  const styleSelect = root.querySelector<HTMLSelectElement>('[data-sm-style]');
  const colorSelect = root.querySelector<HTMLSelectElement>('[data-sm-color]');
  const sizeInput = root.querySelector<HTMLInputElement>('[data-sm-size]');
  const sizeOut = root.querySelector<HTMLElement>('[data-sm-size-out]');
  const strokeInput = root.querySelector<HTMLInputElement>('[data-sm-stroke]');
  const strokeOut = root.querySelector<HTMLElement>('[data-sm-stroke-out]');
  const preview = root.querySelector<HTMLImageElement>('[data-sm-preview]');
  const previewEmpty = root.querySelector<HTMLElement>('[data-sm-preview-empty]');
  const downloadSvgBtn = root.querySelector<HTMLButtonElement>('[data-sm-download-svg]');
  const downloadPngBtn = root.querySelector<HTMLButtonElement>('[data-sm-download-png]');
  const status = root.querySelector<HTMLElement>('[data-sm-status]');
  const errorBox = root.querySelector<HTMLElement>('[data-sm-error]');

  if (canvas.width !== PAD_WIDTH) canvas.width = PAD_WIDTH;
  if (canvas.height !== PAD_HEIGHT) canvas.height = PAD_HEIGHT;

  /** The finished raw strokes (samples straight from the pointer). */
  const strokes: Stroke[] = [];
  /** The stroke currently under the pointer. */
  let live: Point[] = [];
  let drawing = false;
  let mode: 'draw' | 'type' = 'draw';

  const color = (): string => colorSelect?.value ?? '#111827';
  const size = (): number => {
    const n = Number(sizeInput?.value);
    return Number.isFinite(n) && n > 0 ? n : 180;
  };
  const strokeWidth = (): number => {
    const n = Number(strokeInput?.value);
    return Number.isFinite(n) && n > 0 ? n : 3;
  };

  const announce = (message: string): void => {
    if (status) status.textContent = message;
  };

  const showError = (message: string | null): void => {
    if (!errorBox) return;
    errorBox.hidden = !message;
    errorBox.textContent = message ?? '';
  };

  /** Every stroke, smoothed, including the one still being drawn. */
  function smoothedStrokes(): Stroke[] {
    const all = live.length ? [...strokes, live] : strokes;
    return all.map((stroke) => smoothStroke(stroke)).filter((stroke) => stroke.length > 0);
  }

  /** Repaint the pad from the current (smoothed) strokes. */
  function redraw(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintStrokes(ctx, smoothedStrokes(), color(), strokeWidth());
  }

  /** The SVG for the current signature, or `null` when there is nothing yet. */
  function currentSvg(): string | null {
    try {
      if (mode === 'type') {
        const name = nameInput?.value.trim() ?? '';
        if (!name) return null;
        return typedToSvg(name, { color: color(), style: styleSelect?.value, size: size() });
      }
      const drawn = smoothedStrokes();
      if (!drawn.length) return null;
      return strokesToSvg(drawn, { color: color(), strokeWidth: strokeWidth() });
    } catch {
      return null;
    }
  }

  /** Update the preview, the export buttons and the status line. */
  function refresh(): void {
    const svg = currentSvg();
    if (preview) {
      if (svg) {
        preview.src = svgDataUrl(svg);
        preview.hidden = false;
      } else {
        preview.removeAttribute('src');
        preview.hidden = true;
      }
    }
    if (previewEmpty) previewEmpty.hidden = !!svg;
    if (downloadSvgBtn) downloadSvgBtn.disabled = !svg;
    if (downloadPngBtn) downloadPngBtn.disabled = !svg;
    if (svg) {
      announce('Ready — download it as a transparent SVG or PNG.');
    } else {
      announce(
        mode === 'type'
          ? 'Type a name to create a signature.'
          : 'Draw your signature on the pad above.',
      );
    }
  }

  /** Switch between the draw and type sources. */
  function selectMode(next: 'draw' | 'type'): void {
    mode = next;
    for (const tab of tabs) {
      const active = tab.dataset.smTab === next;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.smPanel !== next;
    refresh();
  }

  /* ---------------------------------------------------------------------- */
  /*  Pointer drawing                                                        */
  /* ---------------------------------------------------------------------- */

  function padPoint(event: PointerEvent): Point {
    return toPadPoint(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      canvas.width,
      canvas.height,
    );
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    drawing = true;
    live = [padPoint(event)];
    canvas.setPointerCapture?.(event.pointerId);
    redraw();
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    live.push(padPoint(event));
    redraw();
    event.preventDefault();
  });

  const finishStroke = (): void => {
    if (!drawing) return;
    drawing = false;
    if (live.length) strokes.push(live);
    live = [];
    refresh();
  };

  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', finishStroke);
  canvas.addEventListener('pointerleave', finishStroke);

  clearBtn?.addEventListener('click', () => {
    strokes.length = 0;
    live = [];
    refresh();
    announce('Pad cleared.');
  });

  /* ---------------------------------------------------------------------- */
  /*  Controls                                                               */
  /* ---------------------------------------------------------------------- */

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      selectMode(tab.dataset.smTab === 'type' ? 'type' : 'draw');
    });
  }

  const tablist = root.querySelector<HTMLElement>('[data-sm-tabs]');
  tablist?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    selectMode(mode === 'draw' ? 'type' : 'draw');
    tabs.find((tab) => tab.dataset.smTab === mode)?.focus();
  });

  nameInput?.addEventListener('input', refresh);
  styleSelect?.addEventListener('change', refresh);
  colorSelect?.addEventListener('change', refresh);
  sizeInput?.addEventListener('input', () => {
    if (sizeOut) sizeOut.textContent = `${size()} px`;
    refresh();
  });
  strokeInput?.addEventListener('input', () => {
    if (strokeOut) strokeOut.textContent = `${strokeWidth()} px`;
    redraw();
    refresh();
  });

  const exportAs = (format: 'svg' | 'png'): void => {
    const svg = currentSvg();
    if (!svg) return;
    showError(null);
    announce(format === 'png' ? 'Rendering the PNG…' : 'Preparing the SVG…');
    void downloadSignature(svg, format)
      .then(() => announce(`Downloaded your signature (${format.toUpperCase()}).`))
      .catch(() => {
        showError('The signature could not be exported in this browser.');
        announce('Export failed.');
      });
  };

  downloadSvgBtn?.addEventListener('click', () => exportAs('svg'));
  downloadPngBtn?.addEventListener('click', () => exportAs('png'));

  window.addEventListener('pagehide', () => {
    strokes.length = 0;
    live = [];
  });

  // The panel serialises locally, so no worker call is needed.
  if (sizeOut) sizeOut.textContent = `${size()} px`;
  if (strokeOut) strokeOut.textContent = `${strokeWidth()} px`;
  selectMode('draw');
}
