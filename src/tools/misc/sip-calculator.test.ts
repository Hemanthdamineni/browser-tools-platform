import { describe, it, expect } from 'vitest';
import tool from './sip-calculator.tool';

describe('sip-calculator', () => {
  it('calculates standard SIP returns', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'sip', monthlyInvestment: 10000, annualReturn: 12, years: 10, stepUpPercent: 0, lumpsumAmount: 0 },
    });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Total Invested']).toBe('₹12,00,000');
    expect(parseInt(rows['Final Corpus'].replace(/[₹,]/g, ''))).toBeGreaterThan(2000000);
    expect(rows['CAGR (Annualized)']).toBeDefined();
  });

  it('calculates step-up SIP returns', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'step-up', monthlyInvestment: 5000, annualReturn: 12, years: 15, stepUpPercent: 10, lumpsumAmount: 0 },
    });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Total Invested']).toBeDefined();
    expect(parseInt(rows['Final Corpus'].replace(/[₹,]/g, ''))).toBeGreaterThan(parseInt(rows['Total Invested'].replace(/[₹,]/g, '')));
  });

  it('calculates lumpsum returns', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'lumpsum', monthlyInvestment: 0, annualReturn: 12, years: 10, stepUpPercent: 0, lumpsumAmount: 100000 },
    });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Total Invested']).toBe('₹1,00,000');
    expect(parseInt(rows['Final Corpus'].replace(/[₹,]/g, ''))).toBeGreaterThan(300000);
  });

  it('handles 0% return', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'sip', monthlyInvestment: 10000, annualReturn: 0, years: 5, stepUpPercent: 0, lumpsumAmount: 0 },
    });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Total Invested']).toBe('₹6,00,000');
    expect(rows['Final Corpus']).toBe('₹6,00,000');
    expect(rows['Estimated Returns']).toBe('₹0');
  });

  it('includes not-financial-advice disclaimer', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'sip', monthlyInvestment: 10000, annualReturn: 12, years: 10, stepUpPercent: 0, lumpsumAmount: 0 },
    });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    // The disclaimer is in the 'Disclaimer' row
    expect(rows['Disclaimer']).toContain('financial advice');
    expect(rows['Disclaimer']).toContain('SEBI-registered');
    // The '⚠ NOT FINANCIAL ADVICE' row exists as a header
    expect(rows['⚠ NOT FINANCIAL ADVICE']).toBe('');
  });

  it('includes year-by-year breakdown', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'sip', monthlyInvestment: 10000, annualReturn: 12, years: 3, stepUpPercent: 0, lumpsumAmount: 0 },
    });
    const parsed = JSON.parse(res.output);
    const rows = parsed.rows;
    const yearRows = rows.filter((r: string[]) => r[0] === '1' || r[0] === '2' || r[0] === '3');
    expect(yearRows.length).toBe(3);
  });

  it('step-up increases monthly amount each year', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'step-up', monthlyInvestment: 10000, annualReturn: 10, years: 3, stepUpPercent: 10, lumpsumAmount: 0 },
    });
    const parsed = JSON.parse(res.output);
    const rows = parsed.rows;
    const year1 = rows.find((r: string[]) => r[0] === '1');
    const year2 = rows.find((r: string[]) => r[0] === '2');
    const year3 = rows.find((r: string[]) => r[0] === '3');
    expect(year1?.[1]).toBe('₹10,000');
    expect(year2?.[1]).toBe('₹11,000');
    expect(year3?.[1]).toBe('₹12,100');
  });
});