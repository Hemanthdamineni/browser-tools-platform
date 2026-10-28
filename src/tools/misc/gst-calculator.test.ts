import { describe, it, expect } from 'vitest';
import tool from './gst-calculator.tool';

describe('gst-calculator', () => {
  it('adds GST for intra-state transaction', async () => {
    const res = await tool.run({ text: '', options: { mode: 'add', transactionType: 'intra', rate: 18, amount: 1000 } });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Net Amount (excl. GST)']).toBe('₹1,000.00');
    expect(rows['Tax Amount']).toBe('₹180.00');
    expect(rows['Gross Amount (incl. GST)']).toBe('₹1,180.00');
    expect(rows['CGST (Central GST)']).toBe('₹90.00');
    expect(rows['SGST (State GST)']).toBe('₹90.00');
    expect(rows['IGST (Integrated GST)']).toBe('—');
  });

  it('adds GST for inter-state transaction', async () => {
    const res = await tool.run({ text: '', options: { mode: 'add', transactionType: 'inter', rate: 12, amount: 1000 } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Net Amount (excl. GST)']).toBe('₹1,000.00');
    expect(rows['Tax Amount']).toBe('₹120.00');
    expect(rows['Gross Amount (incl. GST)']).toBe('₹1,120.00');
    expect(rows['IGST (Integrated GST)']).toBe('₹120.00');
    expect(rows['CGST (Central GST)']).toBe('—');
    expect(rows['SGST (State GST)']).toBe('—');
  });

  it('removes GST for intra-state transaction', async () => {
    const res = await tool.run({ text: '', options: { mode: 'remove', transactionType: 'intra', rate: 18, amount: 1180 } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Gross Amount (incl. GST)']).toBe('₹1,180.00');
    expect(rows['Tax Amount']).toBe('₹180.00');
    expect(rows['Net Amount (excl. GST)']).toBe('₹1,000.00');
    expect(rows['CGST (Central GST)']).toBe('₹90.00');
    expect(rows['SGST (State GST)']).toBe('₹90.00');
  });

  it('removes GST for inter-state transaction', async () => {
    const res = await tool.run({ text: '', options: { mode: 'remove', transactionType: 'inter', rate: 12, amount: 1120 } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Gross Amount (incl. GST)']).toBe('₹1,120.00');
    expect(rows['Tax Amount']).toBe('₹120.00');
    expect(rows['Net Amount (excl. GST)']).toBe('₹1,000.00');
    expect(rows['IGST (Integrated GST)']).toBe('₹120.00');
  });

  it('handles 0% GST', async () => {
    const res = await tool.run({ text: '', options: { mode: 'add', transactionType: 'intra', rate: 0, amount: 1000 } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Tax Amount']).toBe('₹0.00');
    expect(rows['Gross Amount (incl. GST)']).toBe('₹1,000.00');
  });

  it('handles 28% GST', async () => {
    const res = await tool.run({ text: '', options: { mode: 'add', transactionType: 'intra', rate: 28, amount: 5000 } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Tax Amount']).toBe('₹1,400.00');
    expect(rows['Gross Amount (incl. GST)']).toBe('₹6,400.00');
  });

  it('handles fractional rates', async () => {
    const res = await tool.run({ text: '', options: { mode: 'add', transactionType: 'intra', rate: 12.5, amount: 1000 } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Tax Amount']).toBe('₹125.00');
    expect(rows['Gross Amount (incl. GST)']).toBe('₹1,125.00');
  });

  it('includes disclaimer about rate verification', async () => {
    const res = await tool.run({ text: '', options: { mode: 'add', transactionType: 'intra', rate: 18, amount: 1000 } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Rate Source']).toContain('CBIC');
    expect(rows['Rate Source']).toContain('verify');
  });

  it('validates rate bounds', async () => {
    const res = await tool.run({ text: '', options: { mode: 'add', transactionType: 'intra', rate: 150, amount: 1000 } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Error']).toBe('Rate must be between 0 and 100');
  });
});