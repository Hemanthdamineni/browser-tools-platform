import { describe, expect, it } from 'vitest';
import tool from './compound-interest-calculator.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
type Table = { headers: string[]; rows: string[][] };

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Promise<Result>;
const table = (r: Result) => JSON.parse(r.output) as Table;

const amount = (s: string) => Number(s.replace(/[$,]/g, ''));

describe('compound-interest-calculator', () => {
  it('grows a lump sum with no contribution', async () => {
    const r = await run('go', { principal: 1000, rate: 5, years: 1, compounding: 'annually' });
    expect(r.render).toBe('table');
    const rows = table(r).rows;
    expect(rows.length).toBe(1);
    // P*(1.05) = 1050; interest earned 50
    expect(amount(rows[0]![4]!)).toBeCloseTo(1050, 2);
    expect(amount(rows[0]![3]!)).toBeCloseTo(50, 0);
    expect(amount(rows[0]![1]!)).toBeCloseTo(1000, 0); // start balance
    expect(r.stats?.endingBalance).toBeCloseTo(1050, 2);
  });

  it('monthly compounding matches the nominal formula', async () => {
    const r = await run('calc', { principal: 1000, rate: 12, years: 1, compounding: 'monthly' });
    // A = 1000 * (1 + 0.12/12)^12 = 1000 * 1.01^12 ≈ 1126.825
    expect(amount(table(r).rows[0]![4]!)).toBeCloseTo(1126.825, 2);
    expect(amount(table(r).rows[0]![3]!)).toBeCloseTo(126.825, 2);
  });

  it('daily compounding approaches the continuous limit at a low rate', async () => {
    const r = await run('daily', { principal: 1000, rate: 5, years: 1, compounding: 'daily' });
    // (1 + 0.05/365)^365 ≈ 1.051267; A ≈ 1051.27
    expect(amount(table(r).rows[0]![4]!)).toBeCloseTo(1051.27, 1);
  });

  it('continuous compounding uses e^rt', async () => {
    const r = await run('exp', { principal: 1000, rate: 5, years: 1, compounding: 'continuous' });
    // 1000 * e^0.05 ≈ 1051.271, interest ≈ 51.27
    expect(amount(table(r).rows[0]![4]!)).toBeCloseTo(1051.27, 1);
    expect(amount(table(r).rows[0]![3]!)).toBeCloseTo(51.27, 1);
  });

  it('contributions follow the ordinary-annuity formula', async () => {
    const r = await run('annuity', { principal: 0, rate: 12, years: 1, compounding: 'monthly', contribution: 100 });
    // FV of ordinary annuity = 100 * ((1.01)^12 - 1) / 0.01 ≈ 1268.25
    expect(amount(table(r).rows[0]![4]!)).toBeCloseTo(1268.25, 2);
    expect(amount(table(r).rows[0]![1]!)).toBeCloseTo(0, 2); // start = 0
    expect(amount(table(r).rows[0]![2]!)).toBeCloseTo(1200, 0); // 12×100 contributed
    expect(r.stats?.totalInterest).toBeCloseTo(68.25, 1);
    expect(r.stats?.totalInvested).toBeCloseTo(1200, 0);
  });

  it('reports period-by-period over multiple years', async () => {
    const r = await run('multi', { principal: 5000, rate: 6, years: 5, compounding: 'quarterly' });
    const rows = table(r).rows;
    expect(rows.length).toBe(5);
    // Year-to-year end balance rises: 5000*(1.015)^2 ≈ 5151.1, ...
    expect(amount(rows[4]![4]!)).toBeGreaterThan(amount(rows[0]![4]!));
    expect(r.stats?.years).toBe(5);
    expect(r.stats?.endingBalance).toBeGreaterThan(5000);
  });

  it('rejects a contribution with continuous compounding', async () => {
    await expect(run('cont', { principal: 1000, rate: 5, years: 1, compounding: 'continuous', contribution: 100 }))
      .rejects.toThrow(/continuous.*contribution/i);
  });

  it('stats include ending balance, invested and interest', async () => {
    const r = await run('stats', { principal: 10000, rate: 5, years: 5, compounding: 'monthly', contribution: 200 });
    expect(r.stats?.endingBalance).toBeGreaterThan(20000);
    expect(r.stats?.totalInvested).toBeCloseTo(10000 + 200 * 60, 0);
    expect(r.stats?.totalInterest).toBeGreaterThan(0);
  });

  it('notes mention multiplier and totals', async () => {
    const r = await run('notes', { principal: 1000, rate: 10, years: 3, compounding: 'monthly' });
    const joined = r.notes?.join(' ') ?? '';
    expect(joined).toMatch(/total invested/i);
    expect(joined).toMatch(/total interest/i);
    expect(joined).toMatch(/multiplier/i);
  });

  it('handles zero rate gracefully', async () => {
    const r = await run('zero', { principal: 1000, rate: 0, years: 3, compounding: 'annually', contribution: 100 });
    const rows = table(r).rows;
    console.log(JSON.stringify(rows));
    expect(amount(rows[2]![2]!)).toBeCloseTo(100, 0); // contribution per year
    expect(amount(rows[2]![3]!)).toBeCloseTo(0, 0); // no interest at 0%
    expect(amount(rows[2]![4]!)).toBeCloseTo(1000 + 300, 0); // principal + 3×100 contributions
    expect(r.stats?.totalInterest).toBeCloseTo(0, 1);
  });
});
