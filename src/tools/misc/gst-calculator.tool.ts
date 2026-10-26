import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { GST_SLABS, RATES_AS_OF, RATES_SOURCE, meta } from './gst-calculator.meta';

type Mode = 'add' | 'remove';
type Supply = 'intra' | 'inter';

const MONEY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Round to 2 decimal places (nearest paisa, halves up). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const money = (n: number): string => MONEY.format(round2(n));

/** Format a percentage without float noise: 0.125 → "0.125%", 9 → "9%". */
function rateLabel(rate: number): string {
  return `${Number(rate.toFixed(6))}%`;
}

/** Parse a user-supplied number. Returns null when the text is not a number. */
function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/^(?:rs\.?|inr)\s*/i, '')
    .replace(/[\u20b9,\s]/g, '')
    .replace(/(?:rs\.?|inr)$/i, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** A number typed into the text box overrides the Amount option. */
function typedAmount(text: string): number | null {
  if (!text.trim()) return null;
  const n = parseNumber(text);
  return n !== null && n >= 0 ? n : null;
}

function resolveRate(value: unknown, custom: unknown): number {
  const selected = String(value);
  if (selected === 'custom') {
    const rate = parseNumber(custom);
    if (rate === null) {
      throw new ToolError(
        'Enter a custom GST rate.',
        'Use a number between 0 and 100, for example 12.5.',
      );
    }
    if (rate < 0 || rate > 100) {
      throw new ToolError(
        `Custom GST rate must be between 0% and 100% (got ${rate}%).`,
        'Pick one of the notified slabs or enter a rate inside that range.',
      );
    }
    return rate;
  }
  const slab = GST_SLABS.find((s) => String(s.rate) === selected);
  if (!slab) {
    throw new ToolError(
      `Unknown GST rate "${selected}".`,
      'The 12% and 28% slabs were replaced in September 2025 — pick 5%, 18%, 40% or a custom rate.',
    );
  }
  return slab.rate;
}

function resolveMode(value: unknown): Mode {
  const mode = String(value);
  if (mode !== 'add' && mode !== 'remove') {
    throw new ToolError(
      `Unknown mode "${mode}".`,
      'Choose either "Add GST to a price" or "Remove GST from a price".',
    );
  }
  return mode;
}

function resolveSupply(value: unknown): Supply {
  const supply = String(value);
  if (supply !== 'intra' && supply !== 'inter') {
    throw new ToolError(
      `Unknown supply type "${supply}".`,
      'Choose either an intra-state supply (CGST + SGST) or an inter-state supply (IGST).',
    );
  }
  return supply;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  const mode = resolveMode(o.mode);
  const supply = resolveSupply(o.supply);
  const rate = resolveRate(o.rate, o.customRate);

  const optionAmount = parseNumber(o.amount);
  if (optionAmount === null) {
    throw new ToolError(
      'Enter a valid amount.',
      'Type a number such as 1000 or 1000.50 in the Amount field.',
    );
  }
  if (optionAmount < 0) {
    throw new ToolError(
      `Amount cannot be negative (got ${optionAmount}).`,
      'Enter zero or a positive amount.',
    );
  }

  const typed = typedAmount(input.text ?? '');
  const amount = round2(typed ?? optionAmount);

  const r = rate / 100;

  // Taxable value: the price before GST (add) or the inclusive total taken
  // back to its pre-tax value (remove).
  const base = mode === 'add' ? amount : round2(amount / (1 + r));

  // Each component is computed on the taxable value and rounded to the paisa.
  const half = round2(base * (rate / 200));
  const cgst = supply === 'intra' ? half : 0;
  const sgst = supply === 'intra' ? half : 0;
  const igst = supply === 'inter' ? round2(base * r) : 0;

  const totalTax = round2(cgst + sgst + igst);
  const gross = round2(base + totalTax);

  const rows: string[][] = [['Taxable value (base)', '\u2014', money(base)]];
  if (supply === 'intra') {
    rows.push(['CGST \u00b7 Central GST', rateLabel(rate / 2), money(cgst)]);
    rows.push(['SGST \u00b7 State GST', rateLabel(rate / 2), money(sgst)]);
  } else {
    rows.push(['IGST \u00b7 Integrated GST', rateLabel(rate), money(igst)]);
  }
  rows.push(['Total GST', rateLabel(rate), money(totalTax)]);
  rows.push(['Gross amount (incl. GST)', '\u2014', money(gross)]);

  const notes: string[] = [
    `Rates verified on ${RATES_AS_OF} \u2014 source: ${RATES_SOURCE}`,
    'Not financial advice \u2014 this is a generic calculator. It does not decide which rate applies to a product or service, and it ignores input tax credit, compensation cess and anti-profiteering rules.',
    'Rounding: each tax component is computed on the taxable value and rounded to the nearest paisa (2 dp, halves rounded up). The gross amount is the taxable value plus the rounded components, so it can differ from a hand-worked total by up to \u20b90.01.',
    'Rate notifications: Notification No. 9/2025-Central Tax (Rate) (CGST) and Notification No. 9/2025-Integrated Tax (Rate) (IGST), both dated 17 September 2025.',
  ];

  if (mode === 'add') {
    notes.push(
      `Added ${rate}% GST to ${money(amount)} \u2014 tax ${money(totalTax)}, gross ${money(gross)}.`,
    );
  } else {
    notes.push(
      `Taken GST out of the ${money(amount)} inclusive total: taxable value ${money(base)} \u2192 GST ${money(totalTax)}.`,
    );
  }

  if (supply === 'intra') {
    notes.push(
      'Intra-state supply: CGST and SGST apply, each exactly half of the GST. IGST is not charged.',
    );
  } else {
    notes.push('Inter-state supply: IGST applies at the full rate. CGST and SGST are not charged.');
  }

  return {
    output: JSON.stringify({
      headers: ['Line item', 'Rate', 'Amount'],
      rows,
    }),
    render: 'table',
    stats: {
      mode,
      supply,
      rate,
      base,
      cgst,
      sgst,
      igst,
      totalTax,
      gross,
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
