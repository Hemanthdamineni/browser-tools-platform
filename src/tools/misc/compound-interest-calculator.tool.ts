import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './compound-interest-calculator.meta';

type Row = string[];

const FREQ: Record<string, { periods: number; label: string }> = {
  annually: { periods: 1, label: 'Annually' },
  quarterly: { periods: 4, label: 'Quarterly' },
  monthly: { periods: 12, label: 'Monthly' },
  daily: { periods: 365, label: 'Daily' },
  continuous: { periods: 0, label: 'Continuously' },
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const money0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  maximumSignificantDigits: 20,
});

const fmt = (n: number) => money.format(n);

function numOption(value: unknown, def: number, min: number, max: number): number {
  const n = Number(value);
  const v = Number.isFinite(n) ? n : def;
  return Math.max(min, Math.min(max, v));
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);

  const principal = numOption(o.principal, 0, 0, 1e15);
  const annualRate = numOption(o.rate, 5, 0, 1e6);
  const years = Math.round(numOption(o.years, 10, 1, 100));
  const contribution = numOption(o.contribution, 0, 0, 1e15);

  const freq = FREQ[String(o.compounding)] ?? FREQ.monthly!;
  const continuous = String(o.compounding) === 'continuous';

  if (continuous && contribution > 0) {
    throw new ToolError(
      'Continuous compounding does not support a periodic contribution.',
      'Pick a discrete frequency (monthly, quarterly, daily or annually) to include regular deposits.',
    );
  }

  let balance = principal;
  let totalContributed = principal;
  let totalInterest = 0;
  const rows: Row[] = [];

  if (continuous) {
    const r = annualRate / 100;
    for (let y = 1; y <= years; y++) {
      const start = balance;
      const interest = start * (Math.exp(r) - 1);
      balance = start * Math.exp(r);
      totalInterest += interest;
      rows.push([String(y), fmt(start), '$0', fmt(interest), fmt(balance)]);
    }
  } else {
    const periodsPerYear = freq.periods;
    const perRate = annualRate / 100 / periodsPerYear;
    for (let y = 1; y <= years; y++) {
      const start = balance;
      let yearContribution = 0;
      let yearInterest = 0;
      for (let p = 0; p < periodsPerYear; p++) {
        const interest = balance * perRate;
        balance += interest;
        yearInterest += interest;
        balance += contribution;
        yearContribution += contribution;
      }
      totalInterest += yearInterest;
      totalContributed += yearContribution;
      rows.push([String(y), fmt(start), fmt(yearContribution), fmt(yearInterest), fmt(balance)]);
    }
  }

  const ending = balance;
  const notes: string[] = [
    `Total invested: ${money0.format(principal)} initial + ${money0.format(totalContributed - principal)} in deposits.`,
    `Total interest earned across ${years} year${years === 1 ? '' : 's'}: ${money.format(totalInterest)}.`,
    `Growth multiplier: ${(totalContributed > 0 ? ending / totalContributed : ending / principal).toFixed(2)}\u00d7`,
  ];

  return {
    output: JSON.stringify({
      headers: ['Period', 'Start Balance', 'Contribution', 'Interest Earned', 'End Balance'],
      rows,
    }),
    render: 'table',
    stats: {
      years,
      endingBalance: Number(ending.toFixed(2)),
      totalInvested: Number(totalContributed.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
