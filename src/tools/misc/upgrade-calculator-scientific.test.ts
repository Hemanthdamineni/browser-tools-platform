import { describe, it, expect } from 'vitest';
import tool from './upgrade-calculator-scientific.tool';

describe('upgrade-calculator-scientific', () => {
  it('evaluates basic arithmetic', async () => {
    const res = await tool.run({ text: '2 + 3 * 4', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res.render).toBe('code');
    expect(res.output).toBe('14');
  });

  it('evaluates powers', async () => {
    const res = await tool.run({ text: '2^10', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res.output).toBe('1024');
  });

  it('evaluates factorial', async () => {
    const res = await tool.run({ text: '5!', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res.output).toBe('120');
  });

  it('evaluates trigonometric functions in degrees', async () => {
    const res = await tool.run({ text: 'sin(30)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res.output)).toBeCloseTo(0.5, 5);
  });

  it('evaluates trigonometric functions in radians', async () => {
    const res = await tool.run({ text: 'sin(pi/2)', options: { angleMode: 'radians', precision: 10, showHistory: true } });
    expect(parseFloat(res.output)).toBeCloseTo(1, 5);
  });

  it('evaluates inverse trigonometric functions', async () => {
    const res = await tool.run({ text: 'asin(0.5)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res.output)).toBeCloseTo(30, 5);
  });

  it('evaluates logarithmic functions', async () => {
    const res = await tool.run({ text: 'ln(e)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res.output)).toBeCloseTo(1, 5);
  });

  it('evaluates log10 and log2', async () => {
    const res1 = await tool.run({ text: 'log10(100)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res1.output).toBe('2');
    const res2 = await tool.run({ text: 'log2(8)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res2.output).toBe('3');
  });

  it('evaluates constants', async () => {
    const res = await tool.run({ text: 'pi', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res.output)).toBeCloseTo(Math.PI, 5);
  });

  it('evaluates phi and tau', async () => {
    const res1 = await tool.run({ text: 'phi', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res1.output)).toBeCloseTo((1 + Math.sqrt(5)) / 2, 5);
    const res2 = await tool.run({ text: 'tau', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res2.output)).toBeCloseTo(2 * Math.PI, 5);
  });

  it('evaluates combinations and permutations', async () => {
    const res1 = await tool.run({ text: 'nCr(5, 2)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res1.output).toBe('10');
    const res2 = await tool.run({ text: 'nPr(5, 2)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res2.output).toBe('20');
  });

  it('evaluates gcd and lcm', async () => {
    const res1 = await tool.run({ text: 'gcd(48, 18)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res1.output).toBe('6');
    const res2 = await tool.run({ text: 'lcm(12, 18)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res2.output).toBe('36');
  });

  it('evaluates hyperbolic functions', async () => {
    const res = await tool.run({ text: 'sinh(0)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res.output).toBe('0');
  });

  it('evaluates angle conversions', async () => {
    const res1 = await tool.run({ text: 'deg2rad(180)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res1.output)).toBeCloseTo(Math.PI, 5);
    const res2 = await tool.run({ text: 'rad2deg(pi)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res2.output)).toBeCloseTo(180, 5);
  });

  it('evaluates min, max, clamp', async () => {
    const res1 = await tool.run({ text: 'min(3, 1, 4)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res1.output).toBe('1');
    const res2 = await tool.run({ text: 'max(3, 1, 4)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res2.output).toBe('4');
    const res3 = await tool.run({ text: 'clamp(5, 0, 10)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res3.output).toBe('5');
  });

  it('evaluates sqrt, cbrt, hypot', async () => {
    const res1 = await tool.run({ text: 'sqrt(16)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res1.output).toBe('4');
    const res2 = await tool.run({ text: 'cbrt(27)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res2.output).toBe('3');
    const res3 = await tool.run({ text: 'hypot(3, 4)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res3.output).toBe('5');
  });

  it('handles factorial limits', async () => {
    let error: Error | null = null;
    try {
      await tool.run({ text: '21!', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Factorial requires integer 0–20');
  });

  it('handles division by zero', async () => {
    let error: Error | null = null;
    try {
      await tool.run({ text: '1/0', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Division by zero');
  });

  it('handles empty input', async () => {
    const res = await tool.run({ text: '', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    expect(parsed.rows[0][1]).toContain('Enter an expression');
  });

  it('handles gradians mode', async () => {
    const res = await tool.run({ text: 'sin(100)', options: { angleMode: 'gradians', precision: 10, showHistory: true } });
    expect(parseFloat(res.output)).toBeCloseTo(1, 5);
  });

  it('evaluates complex expression', async () => {
    const res = await tool.run({ text: 'sin(30)^2 + cos(30)^2', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(parseFloat(res.output)).toBeCloseTo(1, 5);
  });

  it('evaluates round, floor, ceil, trunc', async () => {
    const res1 = await tool.run({ text: 'round(3.7)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res1.output).toBe('4');
    const res2 = await tool.run({ text: 'floor(3.7)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res2.output).toBe('3');
    const res3 = await tool.run({ text: 'ceil(3.2)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res3.output).toBe('4');
    const res4 = await tool.run({ text: 'trunc(-3.7)', options: { angleMode: 'degrees', precision: 10, showHistory: true } });
    expect(res4.output).toBe('-3');
  });
});