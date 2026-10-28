/**
 * The signature maker.
 *
 * The interactive drawing and typing live in the panel
 * (`src/components/panels/signature-maker.astro`); this module is the pure,
 * headless entry point. It takes a payload — a typed name or a JSON list of
 * drawn strokes — and serialises it into a transparent SVG that the workbench
 * can preview and download, using the same logic the panel uses.
 *
 * Reuses the shared signature module (`@/lib/signature`): the typed font
 * stacks and the data-URL encoder come from there, so the maker and `pdf-sign`
 * agree on the signature styles.
 */
import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { parseStrokes, svgDataUrl, typedToSvg, strokesToSvg } from './signature-maker.core';
import { meta } from './signature-maker.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const payload = String(input.text ?? '').trim();
  if (!payload) return { output: '' };

  const color = String(o.color ?? '#111827');
  const mode = String(o.mode ?? 'draw');
  const format = String(o.format ?? 'svg');

  if (mode === 'type') {
    const svg = typedToSvg(payload, {
      color,
      style: String(o.style ?? 'script'),
      size: Number(o.size) || 180,
    });
    if (format === 'png') {
      // PNG will be generated client-side from the SVG data URL
      return {
        output: svgDataUrl(svg),
        render: 'image',
        filename: 'signature.png',
        stats: { source: 'typed', format: 'SVG' },
        notes: ['The SVG keeps a transparent background and can be scaled to any size.'],
      };
    }
    return {
      output: svgDataUrl(svg),
      render: 'image',
      filename: 'signature.svg',
      stats: { source: 'typed', format: 'SVG' },
      notes: ['The SVG keeps a transparent background and can be scaled to any size.'],
    };
  }

  const strokes = parseStrokes(payload);
  if (!strokes.length) return { output: '' };
  const svg = strokesToSvg(strokes, {
    color,
    strokeWidth: Number(o.strokeWidth) || 3,
  });
  if (format === 'png') {
    // PNG will be generated client-side from the SVG data URL
    return {
      output: svgDataUrl(svg),
      render: 'image',
      filename: 'signature.png',
      stats: { source: 'drawn', strokes: strokes.length, format: 'SVG' },
      notes: ['The SVG keeps a transparent background — only the ink is exported.'],
    };
  }
  return {
    output: svgDataUrl(svg),
    render: 'image',
    filename: 'signature.svg',
    stats: { source: 'drawn', strokes: strokes.length, format: 'SVG' },
    notes: ['The SVG keeps a transparent background — only the ink is exported.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;