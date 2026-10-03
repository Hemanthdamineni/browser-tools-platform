import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './loan-calculator.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const principal = Number(o.principal);
  const annualRate = Number(o.annualRatePercent);
  const years = Number(o.years);
  const extra = Number(o.extraMonthly);
  if (!Number.isFinite(principal) || principal <= 0) throw new ToolError('Principal must be greater than zero.');
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) throw new ToolError('Annual interest rate must be between 0 and 100.');
  if (!Number.isFinite(years) || years <= 0) throw new ToolError('Loan term must be greater than zero.');
  if (!Number.isFinite(extra) || extra < 0) throw new ToolError('Extra monthly payment cannot be negative.');

  const r = annualRate / 1200;
  const n = Math.round(years * 12);
  const payment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  const baseTotalInterest = payment * n - principal;

  let balance = principal;
  let months = 0;
  let actualInterest = 0;
  while (balance > 0 && months < n) {
    const interest = balance * r;
    const pay = Math.min(payment + extra, balance + interest);
    if (pay <= interest) {
      months = Number.POSITIVE_INFINITY;
      break;
    }
    actualInterest += interest;
    balance = Math.max(0, balance + interest - pay);
    months++;
  }
  if (!Number.isFinite(months)) {
    throw new ToolError(
      'The extra payment is too small to clear this loan at this rate — it does not cover the monthly interest.',
    );
  }

  const rows: string[][] = [
    ['Monthly payment', payment.toFixed(2)],
    ['Number of payments', String(months)],
    ['Total paid', (principal + actualInterest).toFixed(2)],
    ['Total interest', actualInterest.toFixed(2)],
  ];
  if (extra > 0) {
    const interestSaved = Math.max(0, baseTotalInterest - actualInterest);
    rows.push(['Payoff time', `${Math.floor(months / 12)}y ${months % 12}m (${months} payments)`]);
    rows.push(['Interest saved', interestSaved.toFixed(2)]);
    rows.push(['Time saved', `${n - months} payments`]);
  }
  return {
    output: JSON.stringify({ headers: ['Item', 'Value'], rows }),
    render: 'table',
    stats: { monthly: payment.toFixed(2) },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
