import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './checksum-validator.tool';

type Result = { output: string; stats?: Record<string, string | number> };
const run = (text: string, format = 'auto') =>
  tool.run({ text, options: { format } }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('checksum-validator', () => {
  it('validates Luhn values and preserves unsupported lengths as invalid', () => {
    expect(rows(run('4111 1111 1111 1111', 'luhn'))[0]?.slice(1, 3)).toEqual(['Luhn', 'Valid checksum']);
    expect(rows(run('4111 1111 1111 1112', 'luhn'))[0]?.[2]).toBe('Invalid / unsupported');
    expect(rows(run('1234', 'luhn'))[0]?.[3]).toContain('12–19 digits');
  });

  it('validates IBAN MOD-97 and rejects bad checksums', () => {
    expect(rows(run('GB82 WEST 1234 5698 7654 32', 'iban'))[0]?.[2]).toBe('Valid checksum');
    expect(rows(run('GB81 WEST 1234 5698 7654 32', 'iban'))[0]?.[2]).toBe('Invalid / unsupported');
    expect(rows(run('not-an-iban', 'iban'))[0]?.[3]).toContain('Expected 2 letters');
  });

  it('validates ISBN-10 X and ISBN-13 values', () => {
    expect(rows(run('0-306-40615-2', 'isbn'))[0]?.[2]).toBe('Valid checksum');
    expect(rows(run('0-8044-2957-X', 'isbn'))[0]?.[2]).toBe('Valid checksum');
    expect(rows(run('978-0-306-40615-7', 'isbn'))[0]?.[2]).toBe('Valid checksum');
    expect(rows(run('9780306406158', 'isbn'))[0]?.[2]).toBe('Invalid / unsupported');
  });

  it('auto-detects ISBN and IBAN while defaulting digit values to Luhn', () => {
    expect(rows(run('9780306406157\nGB82WEST12345698765432\n4111111111111111')).map((row) => row[1])).toEqual([
      'ISBN-13', 'IBAN', 'Luhn',
    ]);
  });

  it('checks multiple non-empty lines and reports aggregate counts', () => {
    const result = run('4111111111111111\n\n4111111111111112', 'luhn');
    expect(rows(result)).toHaveLength(2);
    expect(result.stats).toMatchObject({ checked: 2, 'valid checksums': 1, 'invalid / unsupported': 1 });
  });

  it('returns guidance for blank input and rejects unknown formats', () => {
    expect(rows(run(''))).toEqual([]);
    expect(() => run('123', 'other')).toThrow(ToolError);
  });
});
