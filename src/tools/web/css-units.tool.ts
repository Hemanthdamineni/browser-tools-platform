import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './css-units.meta';

/** Convert any supported unit to px. */
function toPx(v: number, unit: string, root: number, parent: number, pctBase: number): number {
  switch (unit) {
    case 'px':
      return v;
    case 'rem':
      return v * root;
    case 'em':
      return v * parent;
    case 'pt':
      return (v * 96) / 72;
    case 'pc':
      return v * 16;
    case 'in':
      return v * 96;
    case 'cm':
      return (v * 96) / 2.54;
    case 'mm':
      return (v * 96) / 25.4;
    case '%':
      return (v / 100) * pctBase;
    default:
      throw new ToolError(`Unsupported unit "${unit}".`);
  }
}

function trim(n: number): string {
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const m = /^\s*(-?\d*\.?\d+)\s*([a-z%]*)\s*$/i.exec(input.text);
  if (!m) {
    throw new ToolError(
      'Enter a number, optionally with a unit.',
      'Examples: 24px, 1.5rem, 12pt, 100%',
    );
  }
  const value = Number(m[1]);
  const unit = m[2] || String(o.fromUnit);
  const root = Number(o.rootFontSize);
  const parent = Number(o.parentFontSize);
  const pctBase = Number(o.percentBase);
  const px = toPx(value, unit, root, parent, pctBase);

  const rows: string[][] = [
    ['px', trim(px)],
    ['rem', trim(px / root)],
    ['em', trim(px / parent)],
    ['pt', trim((px * 72) / 96)],
    ['%', trim((px / pctBase) * 100)],
  ];

  return {
    output: JSON.stringify({ headers: ['Unit', 'Value'], rows }),
    render: 'table',
    stats: { [String(o.toUnit)]: rows.find((r) => r[0] === o.toUnit)?.[1] ?? '' },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
