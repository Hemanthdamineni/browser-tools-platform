import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './matrix-calculator.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('matrix-calculator', () => {
  it('adds and subtracts matrices', async () => {
    expect((await run('1 2\n3 4', { operation: 'add', matrixB: '5 6\n7 8' })).output).toBe(
      '6\t8\n10\t12',
    );
    expect(
      (await run('5,6\n7,8', { operation: 'subtract', matrixBSubtract: '1,2\n3,4' })).output,
    ).toBe('4\t4\n4\t4');
  });

  it('multiplies compatible rectangular matrices', async () => {
    const result = await run('1 2 3\n4 5 6', {
      operation: 'multiply',
      matrixBMultiply: '7 8\n9 10\n11 12',
    });
    expect(result.output).toBe('58\t64\n139\t154');
    expect(result.stats).toMatchObject({ rows: 2, columns: 2 });
  });

  it('transposes a rectangular matrix', async () => {
    const result = await run('1,2,3\n4,5,6', { operation: 'transpose' });
    expect(result.output).toBe('1\t4\n2\t5\n3\t6');
    expect(result.stats).toMatchObject({ rows: 3, columns: 2 });
  });

  it('computes determinants including pivot row swaps and singular matrices', async () => {
    expect((await run('3 8\n4 6', { operation: 'determinant' })).output).toBe('-14');
    expect((await run('0 1\n2 3', { operation: 'determinant' })).output).toBe('-2');
    expect((await run('1 2\n2 4', { operation: 'determinant' })).output).toBe('0');
    expect((await run('5', { operation: 'determinant' })).output).toBe('5');
  });

  it('inverts matrices and handles pivoting', async () => {
    expect((await run('4 7\n2 6', { operation: 'inverse' })).output).toBe('0.6\t-0.7\n-0.2\t0.4');
    expect((await run('0 1\n1 0', { operation: 'inverse' })).output).toBe('0\t1\n1\t0');
  });

  it('rejects non-square, singular, or ill-conditioned inverse inputs', async () => {
    await expect(run('1 2 3\n4 5 6', { operation: 'inverse' })).rejects.toThrow(/square/i);
    await expect(run('1 2\n2 4', { operation: 'inverse' })).rejects.toThrow(/singular/i);
    await expect(run('1 1\n1 1.0000000000001', { operation: 'inverse' })).rejects.toThrow(
      /singular/i,
    );
  });

  it('rejects incompatible matrix dimensions', async () => {
    await expect(run('1 2\n3 4', { operation: 'add', matrixB: '1 2 3' })).rejects.toThrow(
      /dimensions/i,
    );
    await expect(
      run('1 2\n3 4', { operation: 'multiply', matrixBMultiply: '1 2\n3 4\n5 6' }),
    ).rejects.toThrow(/columns in A/i);
  });

  it('rejects ragged rows and invalid or non-finite values', async () => {
    await expect(run('1 2\n3')).rejects.toThrow(/rectangular/i);
    await expect(run('1 nope')).rejects.toThrow(ToolError);
    await expect(run('NaN Infinity')).rejects.toThrow(ToolError);
  });

  it('handles blank lines and returns empty output for blank input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('1 2\n\n3 4', { operation: 'transpose' })).output).toBe('1\t3\n2\t4');
  });

  it('enforces the documented dimension limit and guards overflow', async () => {
    const oversized = Array.from({ length: 21 }, () => '1').join('\n');
    await expect(run(oversized)).rejects.toThrow(/20 rows/i);
    await expect(
      run('1e308 1e308\n1e308 -1e308', { operation: 'multiply', matrixBMultiply: '2\n2' }),
    ).rejects.toThrow(/numeric range/i);
  });
});
