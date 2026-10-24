import { describe, expect, it } from 'vitest';
import tool, {
  buildGrowthChart,
  buildYearTable,
  formatCompactINR,
  formatINR,
  parseInputs,
  simulateSip,
  type GrowthPoint,
  type SipProjection,
} from './sip-calculator.tool';
import { ToolError } from '@/lib/types';

type Result = {
  output: string;
  render?: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
type Table = { headers: string[]; rows: string[][] };
type Options = Record<string, string | number | boolean>;

const run = async (options: Options = {}, text = '') =>
  (await tool.run({ text, options })) as Result;

const table = (r: Result) => JSON.parse(r.output) as Table;

/** "₹11,50,193.45" → 1150193.45 */
const amount = (s: string): number => Number(s.replace(/[₹,\s]/g, ''));

const BASE: Options = {
  monthlySip: 5000,
  stepUpPercent: 0,
  annualReturnPercent: 12,
  years: 10,
  months: 0,
  lumpsum: 0,
  timing: 'start',
};

const project = (overrides: Partial<Parameters<typeof parseInputs>[0]> = {}): SipProjection =>
  simulateSip(parseInputs({ ...BASE, ...overrides } as never));

describe('sip-calculator', () => {
  it('projects a plain monthly SIP at 12% for 10 years (start of month)', async () => {
    const r = await run({ ...BASE });
    const p = project();
    // 5000 * (((1.01^120) - 1) / 0.01) * 1.01 = 1161695.38
    expect(p.estimatedValue).toBeCloseTo(1161695.38, 2);
    expect(amount(r.stats!.estimatedValue as string)).toBeCloseTo(1161695.38, 2);
    expect(p.totalInvested).toBeCloseTo(600000, 2);
    expect(p.months).toBe(120);
  });

  it('charges one extra month of interest when the instalment lands at the end of the month', async () => {
    const start = project({ timing: 'start' });
    const end = project({ timing: 'end' });
    // Ordinary annuity: 5000 * (((1.01^120) - 1) / 0.01) = 1150193.45
    expect(end.estimatedValue).toBeCloseTo(1150193.45, 2);
    // Start of month is exactly one month's interest higher.
    expect(start.estimatedValue).toBeCloseTo(end.estimatedValue * 1.01, 2);
    expect(start.estimatedValue - end.estimatedValue).toBeCloseTo(end.estimatedValue * 0.01, 2);
  });

  it('matches the annuity formula for a mid-plan instalment schedule', () => {
    const p = project({ monthlySip: 10000, annualReturnPercent: 6, years: 5, timing: 'end' });
    // 10000 * (((1.005^60) - 1) / 0.005) = 697,700.31
    expect(p.estimatedValue).toBeCloseTo(697700.31, 2);
  });

  it('raises the instalment once a year with the step-up', () => {
    const p = project({ monthlySip: 10000, stepUpPercent: 10, annualReturnPercent: 0 });
    expect(p.points).toHaveLength(10);
    // Year-by-year instalments, checked by hand.
    const expected = [
      10000, 11000, 12100, 13310, 14641, 16105.1, 17715.61, 19487.171, 21435.8881, 23579.47691,
    ];
    p.points.forEach((point, i) => {
      expect(point.sip).toBeCloseTo(expected[i]!, 6);
    });
    // 120000 + 132000 + 145200 + 159720 + 175692 + 193261.20 + 212587.32 + 233846.052
    //   + 257230.6572 + 282953.72292 = 1912490.95212
    expect(p.totalInvested).toBeCloseTo(1912490.95, 2);
    // With no return, value === invested.
    expect(p.estimatedValue).toBeCloseTo(p.totalInvested, 6);
    expect(p.estimatedGain).toBeCloseTo(0, 6);
  });

  it('adds a one-time lumpsum invested at the start', () => {
    const withLumpsum = project({
      monthlySip: 0,
      lumpsum: 100000,
      annualReturnPercent: 12,
      years: 1,
    });
    // 100000 * 1.01^12 = 112682.50
    expect(withLumpsum.estimatedValue).toBeCloseTo(112682.5, 2);
    expect(withLumpsum.totalInvested).toBeCloseTo(100000, 2);
    expect(withLumpsum.points[0]!.value).toBeCloseTo(112682.5, 2);

    // The lumpsum is counted from day one, not from the first year end.
    const p = project({ monthlySip: 0, lumpsum: 100000, annualReturnPercent: 0, years: 1 });
    expect(p.totalInvested).toBeCloseTo(100000, 2);
  });

  it('reports the gain as the value minus everything invested', async () => {
    const p = project({ monthlySip: 5000, stepUpPercent: 10, lumpsum: 100000 });
    expect(p.estimatedGain).toBeCloseTo(p.estimatedValue - p.totalInvested, 6);
    const r = await run({ ...BASE, stepUpPercent: 10, lumpsum: 100000 });
    // The stats are rounded to paise, so allow a paisa of slack.
    const shown =
      amount(r.stats!.estimatedValue as string) - amount(r.stats!.totalInvested as string);
    expect(Math.abs(shown - amount(r.stats!.estimatedGain as string))).toBeLessThanOrEqual(0.02);
  });

  it('formats money with Indian lakh/crore grouping', () => {
    expect(formatINR(1161695.38)).toBe('₹11,61,695.38');
    expect(formatINR(100000)).toBe('₹1,00,000.00');
    expect(formatINR(10000000)).toBe('₹1,00,00,000.00');
    expect(formatCompactINR(120000)).toBe('₹1.2 L');
    expect(formatCompactINR(25000000)).toBe('₹2.5 Cr');
  });

  it('returns a year-by-year table', async () => {
    const r = await run({ ...BASE, view: 'table' });
    expect(r.render).toBe('table');
    const data = table(r);
    expect(data.headers).toEqual(['Year', 'SIP per month', 'Invested so far', 'Value at year end']);
    expect(data.rows).toHaveLength(10);
    expect(data.rows[0]![0]).toBe('Year 1');
    // End of year 1: 60000 paid in, 5000 * ((1.01^12 - 1) / 0.01) * 1.01 = 64,046.64
    expect(amount(data.rows[0]![2]!)).toBeCloseTo(60000, 2);
    expect(amount(data.rows[0]![3]!)).toBeCloseTo(64046.64, 2);
    // End of year 10.
    expect(amount(data.rows[9]![2]!)).toBeCloseTo(600000, 2);
    expect(amount(data.rows[9]![3]!)).toBeCloseTo(1161695.38, 2);
  });

  it('returns the growth chart as an SVG data URL', async () => {
    const r = await run({ ...BASE });
    expect(r.render).toBe('image');
    expect(r.output.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(r.filename).toBe('sip-growth.svg');
    // The payload really is the SVG we built.
    const svg = atob(r.output.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
  });

  it('draws a well-formed chart with one marker per year', () => {
    const p = project();
    const svg = buildGrowthChart(p.points, { title: 'SIP growth', startValue: 0 });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    // One point per year.
    expect(doc.querySelectorAll('circle')).toHaveLength(p.points.length);
    expect(p.points).toHaveLength(10);
    // Axis labels and a legend.
    const text = [...doc.querySelectorAll('text')].map((t) => t.textContent ?? '');
    expect(text).toContain('Invested');
    expect(text).toContain('Value');
    expect(text).toContain('Years');
    expect(text).toContain('Value (₹)');
  });

  it('escapes anything that goes into the chart markup', () => {
    const nasty: GrowthPoint[] = [
      { year: 1, label: '<script>alert("x")</script>', invested: 1, value: 2, sip: 1 },
    ];
    const svg = buildGrowthChart(nasty, { title: '<img src=x onerror=alert(1)>' });
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<img');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&lt;img');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
  });
  it('keeps the year-by-year table in step with the chart points', () => {
    const p = project();
    const data = buildYearTable(p);
    expect(data.rows).toHaveLength(p.points.length);
    expect(data.rows.map((r) => r[0])).toEqual(p.points.map((point) => point.label));
    expect(amount(data.rows[4]![3]!)).toBeCloseTo(p.points[4]!.value, 2);
  });

  it('handles a 0% return without inventing growth', () => {
    const p = project({ annualReturnPercent: 0, monthlySip: 10000, years: 3 });
    expect(p.estimatedValue).toBeCloseTo(360000, 2);
    expect(p.estimatedGain).toBeCloseTo(0, 6);
  });

  it('handles a single month', () => {
    const p = project({ years: 0, months: 1, monthlySip: 1000, annualReturnPercent: 12 });
    expect(p.months).toBe(1);
    expect(p.points).toHaveLength(1);
    expect(p.points[0]!.label).toBe('0y 1m');
    // End of month: 1000 * 1.01
    expect(p.estimatedValue).toBeCloseTo(1010, 6);
  });

  it('handles a zero lumpsum', () => {
    const p = project({ lumpsum: 0 });
    expect(p.totalInvested).toBeCloseTo(600000, 2);
    expect(p.estimatedValue).toBeCloseTo(1161695.38, 2);
  });

  it('handles a part-year plan', () => {
    const p = project({ years: 2, months: 6, monthlySip: 1000, annualReturnPercent: 0 });
    expect(p.months).toBe(30);
    expect(p.points).toHaveLength(3);
    expect(p.points[2]!.label).toBe('2y 6m');
    expect(p.totalInvested).toBeCloseTo(30000, 6);
  });

  it('survives a very long tenure without producing Infinity or NaN', () => {
    const p = project({ years: 100, annualReturnPercent: 12, stepUpPercent: 0 });
    expect(Number.isFinite(p.estimatedValue)).toBe(true);
    expect(Number.isFinite(p.totalInvested)).toBe(true);
    expect(Number.isNaN(p.estimatedValue)).toBe(false);
    expect(p.estimatedValue).toBeGreaterThan(0);
    expect(p.points).toHaveLength(100);
  });

  it('rejects an absurd combination instead of overflowing', async () => {
    await expect(
      run({ ...BASE, years: 100, annualReturnPercent: 50, stepUpPercent: 50 }),
    ).rejects.toThrow(ToolError);
  });

  it('rejects negative amounts, a negative rate and a zero-length tenure', async () => {
    await expect(run({ ...BASE, monthlySip: -1 })).rejects.toThrow(/monthly SIP/i);
    await expect(run({ ...BASE, lumpsum: -100 })).rejects.toThrow(/lumpsum/i);
    await expect(run({ ...BASE, annualReturnPercent: -5 })).rejects.toThrow(/annual return/i);
    await expect(run({ ...BASE, stepUpPercent: -5 })).rejects.toThrow(/step-up/i);
    await expect(run({ ...BASE, years: 0, months: 0 })).rejects.toThrow(/duration/i);
  });

  it('rejects values that are not numbers', async () => {
    await expect(run({ ...BASE, monthlySip: 'abc' })).rejects.toThrow(ToolError);
    await expect(run({ ...BASE, annualReturnPercent: '' })).rejects.toThrow(/number/i);
    await expect(run({ ...BASE, years: Number.NaN })).rejects.toThrow(/number/i);
  });

  it('rejects a plan with nothing to invest', async () => {
    await expect(run({ ...BASE, monthlySip: 0, lumpsum: 0 })).rejects.toThrow(/nothing to invest/i);
  });

  it('accepts empty input and returns a neutral result', async () => {
    // No text and no options: the declared defaults drive the calculation.
    const r = await run({}, '');
    expect(r.output.length).toBeGreaterThan(0);
    expect(r.render).toBe('image');
    // Defaults: ₹5,000/month, 10% step-up, 12% return, 10 years.
    expect(amount(r.stats!.estimatedValue as string)).toBeCloseTo(1687163.13, 2);
    expect(amount(r.stats!.totalInvested as string)).toBeCloseTo(956245.48, 2);
  });

  it('carries the not-financial-advice note in the notes and the description', async () => {
    const r = await run({ ...BASE });
    const joined = (r.notes ?? []).join(' ');
    expect(joined).toMatch(/not financial advice/i);
    expect(joined).toMatch(/not guaranteed/i);
    expect(tool.meta.description).toMatch(/not financial advice/i);
    const faq = tool.meta.faq ?? [];
    expect(faq.some((f) => /financial advice/i.test(f.q) && /not guaranteed/i.test(f.a))).toBe(
      true,
    );
  });

  it('points the reader at the year-by-year table when the chart is shown', async () => {
    const r = await run({ ...BASE });
    expect((r.notes ?? []).join(' ')).toMatch(/year-by-year table/i);
  });
});
