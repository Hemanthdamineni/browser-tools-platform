import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './border-radius.meta';

/** One corner set, in CSS order: top-left, top-right, bottom-right, bottom-left. */
type Corners = [number, number, number, number];

/** Format a radius without float noise; zero is unitless, as CSS allows. */
function fmt(value: number, unit: string): string {
  const n = Number.isFinite(value) ? value : 0;
  if (n === 0) return '0';
  return `${+n.toFixed(4)}${unit}`;
}

/**
 * Collapse four values to the shortest equivalent CSS form.
 * Equal values reduce to one; matching opposite pairs to two; a matching
 * bottom-right/bottom-left pair to three.
 */
function collapse(corners: Corners, unit: string): string {
  const [tl = '', tr = '', br = '', bl = ''] = corners.map((n) => fmt(n, unit));
  if (tl === tr && tr === br && br === bl) return tl;
  if (tl === br && tr === bl) return `${tl} ${tr}`;
  if (tr === bl) return `${tl} ${tr} ${br}`;
  return `${tl} ${tr} ${br} ${bl}`;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const unit = o.unit === '%' ? '%' : 'px';
  const read = (key: string) => Math.max(0, Number(o[key]) || 0);

  const horizontal: Corners = [
    read('topLeft'),
    read('topRight'),
    read('bottomRight'),
    read('bottomLeft'),
  ];

  let value = collapse(horizontal, unit);

  if (o.ellipse) {
    const vertical: Corners = [
      read('verticalTopLeft'),
      read('verticalTopRight'),
      read('verticalBottomRight'),
      read('verticalBottomLeft'),
    ];
    const verticalValue = collapse(vertical, unit);
    // A matching vertical set is the same shape as the plain form, so the
    // slash adds nothing: emit the shorter equivalent.
    if (verticalValue !== value) value += ` / ${verticalValue}`;
  }

  return {
    output: `border-radius: ${value};`,
    render: 'code',
    language: 'css',
    stats: {
      'top-left': fmt(horizontal[0], unit),
      'top-right': fmt(horizontal[1], unit),
      'bottom-right': fmt(horizontal[2], unit),
      'bottom-left': fmt(horizontal[3], unit),
    },
    notes: [
      'Paste this into a stylesheet or an inline style attribute.',
      'Elliptical corners use the `x / y` form; the second half is omitted when it matches nothing.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;