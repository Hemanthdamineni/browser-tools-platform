/**
 * Typed signatures: a name rendered with a system font into a transparent PNG.
 *
 * Only generic font stacks are used — nothing is fetched from the network, so
 * the tool keeps working offline and no font licence has to be carried.
 */
import { cropToInk, get2d } from './canvas';
import type { SignatureAsset, SignatureStyle } from './types';

export interface SignatureStyleSpec {
  value: SignatureStyle;
  label: string;
  /** A CSS font stack. Every entry ends in a generic family. */
  font: string;
  italic: boolean;
}

/** The four offered styles, from a flowing script to a typewriter mono. */
export const SIGNATURE_STYLES: SignatureStyleSpec[] = [
  {
    value: 'script',
    label: 'Script',
    font: `'Segoe Script','Bradley Hand','Snell Roundhand','Brush Script MT',cursive`,
    italic: true,
  },
  {
    value: 'classic',
    label: 'Classic',
    font: `'Times New Roman',Times,'Liberation Serif','DejaVu Serif',serif`,
    italic: false,
  },
  {
    value: 'modern',
    label: 'Modern',
    font: `system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue','DejaVu Sans',sans-serif`,
    italic: false,
  },
  {
    value: 'mono',
    label: 'Typewriter',
    font: `ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono','DejaVu Sans Mono',monospace`,
    italic: false,
  },
];

/** Ink colours offered by the typed mode. */
export const SIGNATURE_COLORS = ['#111827', '#1d4ed8', '#b91c1c', '#047857'];

/** Look a style up, falling back to the first one. */
export function signatureStyle(value: unknown): SignatureStyleSpec {
  const found = SIGNATURE_STYLES.find((style) => style.value === value);
  return found ?? SIGNATURE_STYLES[0]!;
}

export interface TypedSignatureOptions {
  /** The name to write. */
  text: string;
  /** One of {@link SIGNATURE_STYLES}. */
  style?: SignatureStyle | string;
  /** Any CSS colour. */
  color?: string;
  /** Font size in pixels — the export resolution follows it. */
  size?: number;
}

/**
 * Render a typed name into a transparent PNG asset.
 * Throws when the name is empty or the canvas is unavailable.
 */
export function renderTypedSignature(options: TypedSignatureOptions): SignatureAsset {
  const text = String(options.text ?? '').trim();
  if (!text) throw new Error('Type a name first.');
  const style = signatureStyle(options.style);
  const size = Math.max(16, Math.min(512, Math.round(options.size ?? 180)));
  const color = options.color || '#111827';

  const canvas = document.createElement('canvas');
  const measure = get2d(canvas);
  const font = `${style.italic ? 'italic ' : ''}${size}px ${style.font}`;
  measure.font = font;
  const metrics = measure.measureText(text);
  const padding = Math.ceil(size * 0.3);
  const width = Math.max(1, Math.ceil(metrics.width) + padding * 2);
  const height = Math.max(1, Math.ceil(size * 1.7) + padding * 2);

  canvas.width = width;
  canvas.height = height;
  const ctx = get2d(canvas);
  // Resizing the canvas resets the context state, so the font is set again.
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, padding, height / 2);

  const ink = cropToInk(canvas);
  if (!ink) throw new Error('The typed name could not be rendered.');
  return { ...ink, mode: 'type', hasAlpha: true };
}
