import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './tip-calculator.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const bill = Number(o.bill);
  const pct = Number(o.tipPercent);
  const split = Number(o.split);
  if (!Number.isFinite(bill) || bill < 0) throw new ToolError('Bill amount cannot be negative or non-finite.');
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new ToolError('Tip percentage must be between 0 and 100.');
  if (!Number.isFinite(split) || split < 1 || split > 1000) throw new ToolError('Split count must be a positive whole number.');
  const count = Math.floor(split);
  const tip = bill * pct / 100;
  let total = bill + tip;
  let per = total / count;
  if (o.roundUp === 'total') total = Math.ceil(total);
  if (o.roundUp === 'per-person') {
    per = Math.ceil(per);
    total = per * count;
  }
  const rows = [
    ['Bill', bill.toFixed(2)],
    ['Tip', `${tip.toFixed(2)} (${pct.toFixed(2)}%)`],
    ['Total', total.toFixed(2)],
    ['Per person', per.toFixed(2)],
    ['Tip per person', (tip / count).toFixed(2)],
  ];
  return { output: JSON.stringify({ headers: ['Item', 'Amount'], rows }), render: 'table', stats: { split: count } };
}

const tool: TextToolModule = { meta, run };
export default tool;
