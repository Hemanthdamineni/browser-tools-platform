import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cubic-bezier.meta';

const KEYWORDS: [string, [number, number, number, number]][] = [
  ['ease', [0.25, 0.1, 0.25, 1]],
  ['linear', [0, 0, 1, 1]],
  ['ease-in', [0.42, 0, 1, 1]],
  ['ease-out', [0, 0, 0.58, 1]],
  ['ease-in-out', [0.42, 0, 0.58, 1]],
];

/** Coordinate of the Bézier at parameter u. */
const coord = (a: number, b: number, c: number, u: number) =>
  (1 - u) * (1 - u) * (1 - u) * a +
  3 * u * (1 - u) * (1 - u) * b +
  3 * u * u * (1 - u) * c +
  u * u * u;

/** Solve x(u) = t for u (Newton, bisection fallback) — the standard CSS approach. */
function solveU(t: number, x1: number, x2: number): number {
  const x = (u: number) => coord(0, x1, x2, u);
  // Newton–Raphson
  let u = t;
  for (let i = 0; i < 8; i++) {
    const dx = x(u) - t;
    if (Math.abs(dx) < 1e-6) return u;
    const slope = 3 * (1 - u) * (1 - u) * x1 + 6 * u * (1 - u) * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(slope) < 1e-6) break;
    u -= dx / slope;
  }
  // Bisection fallback
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    u = (lo + hi) / 2;
    if (x(u) < t) lo = u;
    else hi = u;
  }
  return u;
}

const progress = (t: number, x1: number, y1: number, x2: number, y2: number) => {
  const u = solveU(t, x1, x2);
  return coord(0, y1, y2, u);
};

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const nums = input.text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
    throw new ToolError('Enter four numbers: x1, y1, x2, y2.', 'Example: 0.25, 0.1, 0.25, 1');
  }
  const [x1, y1, x2, y2] = nums as [number, number, number, number];
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new ToolError(
      'x1 and x2 must be between 0 and 1.',
      'y1 and y2 may overshoot; x values may not.',
    );
  }

  const samples = Math.max(3, Math.min(25, Math.round(Number(o.samples) || 11)));
  const rows: string[][] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const p = progress(t, x1, y1, x2, y2);
    rows.push([String(+t.toFixed(4)), String(+p.toFixed(4))]);
  }

  let nearest = KEYWORDS[0]!;
  let best = Infinity;
  for (const [name, v] of KEYWORDS) {
    const d = Math.hypot(v[0] - x1, v[1] - y1, v[2] - x2, v[3] - y2);
    if (d < best) {
      best = d;
      nearest = [name, v];
    }
  }

  return {
    output: JSON.stringify({ headers: ['t', 'progress'], rows }),
    render: 'table',
    stats: {
      'cubic-bezier()': `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
      'nearest keyword': nearest[0],
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
