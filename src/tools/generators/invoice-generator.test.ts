import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import tool from './invoice-generator.tool';
import { emptyModel } from '@/components/panels/invoice-generator-panel';
import type { TextRunInput } from '@/lib/types';

function payload(model: unknown, extra: Record<string, unknown> = {}): TextRunInput {
  return { text: '', options: { model: JSON.stringify(model), ...extra } };
}

const VALID = {
  ...emptyModel(),
  invoiceNumber: 'INV-42',
  from: { ...emptyModel().from, name: 'Sender Co' },
  to: { ...emptyModel().to, name: 'Client Co' },
  lines: [{ description: 'Work', quantity: 3, unitPrice: 20, taxRate: 5 }],
  currency: 'USD',
};

async function runPayload(model: unknown, extra: Record<string, unknown> = {}) {
  return tool.run(payload(model, extra));
}

describe('invoice-generator.tool', () => {
  it('generates a downloadable PDF data URL with totals notes', async () => {
    const result = await runPayload(VALID);
    expect(result.output.startsWith('data:application/pdf;base64,')).toBe(true);
    const base64 = result.output.slice('data:application/pdf;base64,'.length);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(result.filename).toBe('INV-42.pdf');
    expect(result.notes?.[0]).toContain('grand total');
  });

  it('respects the output name option', async () => {
    const result = await runPayload(VALID, { outputName: 'quote.pdf' });
    expect(result.filename).toBe('quote.pdf');
  });

  it('throws a friendly error when the model is missing', async () => {
    await expect(tool.run({ text: '', options: {} })).rejects.toThrow(/invoice form/);
  });

  it('throws a friendly error for an invalid model', async () => {
    const bad = { ...VALID, invoiceNumber: '' };
    await expect(runPayload(bad)).rejects.toThrow(/invoice number/);
  });
});
