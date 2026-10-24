import { describe, it, expect } from 'vitest';
import tool from './gst-calculator.tool';
import { GST_SLABS, RATES_AS_OF, RATES_SOURCE, RATES_SOURCES } from './gst-calculator.meta';
import { ToolError } from '@/lib/types';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, number | string>;
  notes?: string[];
};
type Table = { headers: string[]; rows: string[][] };

const run = (text = '', options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

const table = (r: Result): Table => JSON.parse(r.output) as Table;

/** "₹12,34,567.89" -> 1234567.89 */
const numeric = (cell: string): number => Number(cell.replace(/[^0-9.-]/g, ''));

const row = (t: Table, label: string): string[] => {
  const found = t.rows.find((r) => r[0]!.startsWith(label));
  if (!found) throw new Error(`No row "${label}" in ${JSON.stringify(t.rows)}`);
  return found;
};

const stats = (r: Result) => r.stats as Record<string, number>;

describe('gst-calculator — rate table', () => {
  it('exposes a non-empty slab table with sane, unique rates', () => {
    expect(GST_SLABS.length).toBeGreaterThan(0);
    const rates = GST_SLABS.map((s) => s.rate);
    for (const rate of rates) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    }
    expect(new Set(rates).size).toBe(rates.length);
    for (const slab of GST_SLABS) {
      expect(slab.label.length).toBeGreaterThan(0);
      expect(slab.appliesTo.length).toBeGreaterThan(10);
    }
  });

  it('carries the currently notified slabs', () => {
    const rates = GST_SLABS.map((s) => s.rate);
    // 56th GST Council: 5% merit, 18% standard, 40% de-merit.
    expect(rates).toContain(5);
    expect(rates).toContain(18);
    expect(rates).toContain(40);
    // Special rates: 0.25% rough diamonds, 1.5% job work, 3% precious metals.
    expect(rates).toContain(0.25);
    expect(rates).toContain(1.5);
    expect(rates).toContain(3);
    // Nil-rated goods.
    expect(rates).toContain(0);
    // The abolished 12% and 28% slabs must not be offered.
    expect(rates).not.toContain(12);
    expect(rates).not.toContain(28);
    // Ascending order.
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  });

  it('records when the rates were verified and where they came from', () => {
    expect(RATES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(RATES_SOURCE).toMatch(/^https:\/\//);
    // Every source must be an official government domain.
    const official =
      /^(https:\/\/)?(www\.)?(pib\.gov\.in|gstcouncil\.gov\.in|taxinformation\.cbic\.gov\.in)/;
    expect(official.test(RATES_SOURCE)).toBe(true);
    expect(RATES_SOURCES.length).toBeGreaterThan(0);
    for (const source of RATES_SOURCES) {
      expect(source).toMatch(/^https:\/\//);
      expect(official.test(source)).toBe(true);
    }
  });
});

describe('gst-calculator — adding GST', () => {
  it('adds GST to a tax-exclusive price and splits it CGST/SGST', () => {
    const r = run('', { mode: 'add', amount: 10000, rate: '18', supply: 'intra' });
    expect(r.render).toBe('table');
    const t = table(r);
    expect(t.headers).toEqual(['Line item', 'Rate', 'Amount']);

    expect(numeric(row(t, 'Taxable value')[2]!)).toBe(10000);
    expect(row(t, 'CGST')[1]).toBe('9%');
    expect(numeric(row(t, 'CGST')[2]!)).toBe(900);
    expect(row(t, 'SGST')[1]).toBe('9%');
    expect(numeric(row(t, 'SGST')[2]!)).toBe(900);
    expect(numeric(row(t, 'Total GST')[2]!)).toBe(1800);
    expect(numeric(row(t, 'Gross amount')[2]!)).toBe(11800);

    expect(stats(r).cgst).toBe(900);
    expect(stats(r).sgst).toBe(900);
    expect(stats(r).igst).toBe(0);
    expect(stats(r).totalTax).toBe(1800);
    expect(stats(r).gross).toBe(11800);
  });

  it('charges IGST at the full rate for an inter-state supply', () => {
    const r = run('', { mode: 'add', amount: 10000, rate: '18', supply: 'inter' });
    const t = table(r);
    expect(numeric(row(t, 'IGST')[2]!)).toBe(1800);
    expect(row(t, 'IGST')[1]).toBe('18%');
    // CGST/SGST do not apply to an inter-state supply.
    expect(t.rows.some((x) => x[0]!.startsWith('CGST'))).toBe(false);
    expect(t.rows.some((x) => x[0]!.startsWith('SGST'))).toBe(false);
    expect(stats(r).igst).toBe(1800);
    expect(stats(r).cgst).toBe(0);
    expect(stats(r).sgst).toBe(0);
    expect(stats(r).gross).toBe(11800);
  });

  it('splits the GST into two exactly equal halves for an intra-state supply', () => {
    const r = run('', { mode: 'add', amount: 12345.67, rate: '18', supply: 'intra' });
    const s = stats(r);
    expect(s.cgst).toBe(s.sgst);
    expect(s.cgst! * 2).toBe(s.totalTax);
    expect(s.cgst).toBeCloseTo(1111.11, 2);
    expect(s.totalTax).toBeCloseTo(2222.22, 2);
  });

  it('applies the 40% de-merit rate and the special slabs', () => {
    const demerit = run('', { mode: 'add', amount: 100000, rate: '40', supply: 'intra' });
    expect(stats(demerit).cgst).toBe(20000);
    expect(stats(demerit).sgst).toBe(20000);
    expect(stats(demerit).gross).toBe(140000);

    const special = run('', { mode: 'add', amount: 100000, rate: '0.25', supply: 'intra' });
    expect(stats(special).cgst).toBe(125);
    expect(stats(special).totalTax).toBe(250);
    // The half rate is shown exactly, not rounded to 0.13%.
    expect(row(table(special), 'CGST')[1]).toBe('0.125%');

    const precious = run('', { mode: 'add', amount: 100000, rate: '3', supply: 'intra' });
    expect(stats(precious).totalTax).toBe(3000);

    const jobWork = run('', { mode: 'add', amount: 100000, rate: '1.5', supply: 'intra' });
    expect(stats(jobWork).totalTax).toBe(1500);
  });

  it('honours a custom rate', () => {
    const r = run('', {
      mode: 'add',
      amount: 1000,
      rate: 'custom',
      customRate: 12.5,
      supply: 'intra',
    });
    expect(stats(r).rate).toBe(12.5);
    expect(stats(r).cgst).toBe(62.5);
    expect(stats(r).sgst).toBe(62.5);
    expect(stats(r).totalTax).toBe(125);
    expect(stats(r).gross).toBe(1125);
  });
});

describe('gst-calculator — removing GST', () => {
  it('takes the tax back out of a GST-inclusive total', () => {
    const r = run('', { mode: 'remove', amount: 11800, rate: '18', supply: 'intra' });
    const t = table(r);
    expect(numeric(row(t, 'Taxable value')[2]!)).toBe(10000);
    expect(numeric(row(t, 'CGST')[2]!)).toBe(900);
    expect(numeric(row(t, 'SGST')[2]!)).toBe(900);
    expect(numeric(row(t, 'Total GST')[2]!)).toBe(1800);
    expect(numeric(row(t, 'Gross amount')[2]!)).toBe(11800);
    expect(stats(r).base).toBe(10000);
    expect(stats(r).totalTax).toBe(1800);
  });

  it('takes IGST back out of an inter-state total', () => {
    const r = run('', { mode: 'remove', amount: 140000, rate: '40', supply: 'inter' });
    expect(stats(r).base).toBe(100000);
    expect(stats(r).igst).toBe(40000);
    expect(stats(r).gross).toBe(140000);
  });

  it('round trips: adding then removing GST returns the original base', () => {
    const amounts = [1000, 2500, 999.99, 12345.67, 45000];
    for (const amount of amounts) {
      for (const rate of ['0.25', '3', '5', '18', '40']) {
        const added = run('', { mode: 'add', amount, rate, supply: 'intra' });
        const gross = stats(added).gross!;
        const removed = run('', { mode: 'remove', amount: gross, rate, supply: 'intra' });
        // Every component is rounded to the paisa, so the taxable value can come
        // back one paisa away — never more.
        const drift = Math.round(Math.abs(stats(removed).base! - amount) * 100) / 100;
        expect(drift).toBeLessThanOrEqual(0.01);
        // The tax itself round trips exactly.
        expect(stats(removed).totalTax).toBe(stats(added).totalTax);
      }
    }
  });
});

describe('gst-calculator — rounding and money formatting', () => {
  it('rounds each component to 2 decimal places', () => {
    // 333.33 + 18% is 59.9994 before rounding, 60.00 after.
    const r = run('', { mode: 'add', amount: 333.33, rate: '18', supply: 'intra' });
    expect(stats(r).cgst).toBe(30);
    expect(stats(r).sgst).toBe(30);
    expect(stats(r).totalTax).toBe(60);
    expect(stats(r).gross).toBe(393.33);
    for (const cell of table(r).rows.map((x) => x[2]!)) {
      expect(cell).toMatch(/^\u20b9[\d,]+\.\d{2}$/);
    }
  });

  it('formats rupees with lakh/crore grouping', () => {
    const r = run('', { mode: 'add', amount: 1234567.89, rate: '18', supply: 'intra' });
    const t = table(r);
    expect(row(t, 'Taxable value')[2]).toBe('\u20b912,34,567.89');
    expect(row(t, 'Gross amount')[2]).toBe('\u20b914,56,790.11');
  });
});

describe('gst-calculator — edge cases and errors', () => {
  it('returns a neutral result for a zero amount', () => {
    const r = run('', { mode: 'add', amount: 0, rate: '18', supply: 'intra' });
    expect(stats(r).base).toBe(0);
    expect(stats(r).totalTax).toBe(0);
    expect(stats(r).gross).toBe(0);
  });

  it('returns a neutral result for a nil-rated slab', () => {
    const r = run('', { mode: 'add', amount: 5000, rate: '0', supply: 'intra' });
    expect(stats(r).rate).toBe(0);
    expect(stats(r).totalTax).toBe(0);
    expect(stats(r).gross).toBe(5000);
  });

  it('does not throw on empty input', () => {
    const r = run('');
    expect(r.render).toBe('table');
    expect(table(r).rows.length).toBeGreaterThan(0);
    expect(stats(r).base).toBe(1000);
  });

  it('ignores a non-numeric text input but uses a numeric one', () => {
    const ignored = run('type something here — options drive the calculation', { amount: 500 });
    expect(stats(ignored).base).toBe(500);
    const typed = run('250', { amount: 500 });
    expect(stats(typed).base).toBe(250);
  });

  it('rejects a negative amount', () => {
    expect(() => run('', { amount: -1 })).toThrow(ToolError);
  });

  it('rejects a non-numeric amount', () => {
    expect(() => run('', { amount: 'abc' })).toThrow(ToolError);
    expect(() => run('', { amount: Number.NaN })).toThrow(ToolError);
  });

  it('rejects a rate outside 0–100%', () => {
    expect(() => run('', { rate: 'custom', customRate: 150 })).toThrow(ToolError);
    expect(() => run('', { rate: 'custom', customRate: -5 })).toThrow(ToolError);
    expect(() => run('', { rate: '12' })).toThrow(ToolError);
  });

  it('rejects an unknown mode or supply type', () => {
    expect(() => run('', { mode: 'multiply' })).toThrow(ToolError);
    expect(() => run('', { supply: 'overseas' })).toThrow(ToolError);
  });
});

describe('gst-calculator — disclosures', () => {
  it('shows the verification line, the rounding rule and the no-advice note', () => {
    const r = run('', { amount: 1000 });
    const notes = r.notes ?? [];
    expect(notes.some((n) => n.includes(`Rates verified on ${RATES_AS_OF}`))).toBe(true);
    expect(notes.some((n) => n.includes(RATES_SOURCE))).toBe(true);
    expect(notes.some((n) => /not financial advice/i.test(n))).toBe(true);
    expect(notes.some((n) => /rounding/i.test(n))).toBe(true);
  });

  it('explains which line items apply for each supply type', () => {
    const intra = run('', { supply: 'intra' }).notes ?? [];
    expect(intra.some((n) => /intra-state/i.test(n) && /CGST/i.test(n))).toBe(true);
    const inter = run('', { supply: 'inter' }).notes ?? [];
    expect(inter.some((n) => /inter-state/i.test(n) && /IGST/i.test(n))).toBe(true);
  });
});
