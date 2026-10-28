import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './box-shadow.meta';

/** alpha(a) matches `rgba(0,0,0,0.15)`-style values; other colours pass through. */
function scaleAlpha(color: string, factor: number): string {
  if (factor === 1) return color; // single layer: keep the user's exact colour
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
    color.trim(),
  );
  if (!m) return color;
  const r = m[1]!;
  const g = m[2]!;
  const b = m[3]!;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  return `rgba(${r}, ${g}, ${b}, ${+(a * factor).toFixed(4)})`;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const layers = Math.max(1, Math.round(Number(o.layers) || 1));
  const x = Number(o.offsetX);
  const y = Number(o.offsetY);
  const blur = Number(o.blur);
  const spread = Number(o.spread);
  const color = String(o.color);
  const inset = o.inset ? 'inset ' : '';

  const parts: string[] = [];
  for (let i = 1; i <= layers; i++) {
    const f = i / layers;
    parts.push(
      `${inset}${trim(x * f)}px ${trim(y * f)}px ${trim(blur * f)}px ${trim(spread * f)}px ${scaleAlpha(color, f)}`,
    );
  }
  return { output: `box-shadow: ${parts.join(', ')};`, render: 'code', language: 'css' };
}

function trim(n: number): string {
  const s = String(+n.toFixed(4));
  return s === 'NaN' ? '0' : s;
}

const tool: TextToolModule = { meta, run };
export default tool;
