import { describe, expect, it } from 'vitest';
import tool from './invoice-generator.tool';
import { resolveOptions } from '@/lib/options';
import { meta } from './invoice-generator.meta';

describe('invoice-generator', () => {
  it('should generate a valid PDF invoice', async () => {
    const options = resolveOptions(meta, {
      companyName: 'Test Company',
      invoiceNumber: '001',
      lineItems: JSON.stringify([
        { description: 'Widget A', quantity: 2, price: 29.99 },
        { description: 'Widget B', quantity: 1, price: 49.99 },
      ]),
      taxRate: 8.25,
    });
    const result = await tool.run({ options });
    expect(result.type).toBe('pdf');
    expect(result.name).toMatch(/invoice-\d+\.pdf$/);
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.data.length).toBeGreaterThan(0);
  });
});
