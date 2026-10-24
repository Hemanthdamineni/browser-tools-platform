import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  buildPdfBytes,
  computeTotals,
  currencySymbol,
  emptyModel,
  formatCents,
  formatMoney,
  moneyToCents,
  mountInvoiceGeneratorPanel,
  parseDraft,
  serializeDraft,
  validateModel,
  type InvoiceDraft,
  type InvoiceLine,
} from './invoice-generator-panel';

function model(lines: InvoiceLine[], overrides: Partial<InvoiceDraft> = {}): InvoiceDraft {
  return {
    ...emptyModel(),
    invoiceNumber: 'INV-1',
    from: { ...emptyModel().from, name: 'Acme Sender' },
    to: { ...emptyModel().to, name: 'Acme Client' },
    lines,
    ...overrides,
  };
}

describe('computeTotals', () => {
  it('adds up subtotal, per-line tax, tax total and grand total exactly', () => {
    const m = model([
      { description: 'Service', quantity: 2, unitPrice: 10, taxRate: 5 },
      { description: 'Goods', quantity: 1, unitPrice: 49.99, taxRate: 20 },
    ]);
    const t = computeTotals(m);
    // line1: 2 × 10.00 = 20.00; tax 5% = 1.00
    // line2: 1 × 49.99 = 49.99; tax 20% = 9.998 → 10.00
    expect(t.lineTotals[0]!.lineTotalCents).toBe(2000);
    expect(t.lineTotals[0]!.taxCents).toBe(100);
    expect(t.lineTotals[1]!.lineTotalCents).toBe(4999);
    expect(t.lineTotals[1]!.taxCents).toBe(1000);
    expect(t.subtotalCents).toBe(6999);
    expect(t.taxTotalCents).toBe(1100);
    expect(t.discountCents).toBe(0);
    expect(t.grandTotalCents).toBe(8099);
  });

  it('rounds each line and its tax at two decimals (half-up)', () => {
    const m = model([
      // 0.1 × 3.33 = 0.333 → 33.3¢ → 33¢; tax 5% of 33 = 1.65 → 2¢
      { description: 'Fractional', quantity: 0.1, unitPrice: 3.33, taxRate: 5 },
    ]);
    const t = computeTotals(m);
    expect(t.lineTotals[0]!.lineTotalCents).toBe(33);
    expect(t.lineTotals[0]!.taxCents).toBe(2);
    expect(t.subtotalCents).toBe(33);
    expect(t.taxTotalCents).toBe(2);
    expect(t.grandTotalCents).toBe(35);
  });

  it('rounds a line amount up to the nearest cent', () => {
    // 1 × 10.999 = 1099.9¢ → 1100¢
    const t = computeTotals(
      model([{ description: 'Rounding', quantity: 1, unitPrice: 10.999, taxRate: 0 }]),
    );
    expect(t.lineTotals[0]!.lineTotalCents).toBe(1100);
    expect(t.subtotalCents).toBe(1100);
  });

  it('rounds tax half-up at the half-cent', () => {
    // 3 × 0.01 = 3¢; tax 50% of 3¢ = 1.5 → 2¢
    const t = computeTotals(
      model([{ description: 'Half-up tax', quantity: 3, unitPrice: 0.01, taxRate: 50 }]),
    );
    expect(t.lineTotals[0]!.lineTotalCents).toBe(3);
    expect(t.lineTotals[0]!.taxCents).toBe(2);
    expect(t.subtotalCents).toBe(3);
    expect(t.taxTotalCents).toBe(2);
    expect(t.grandTotalCents).toBe(5);
  });

  it('handles a discount on the subtotal', () => {
    const m = model(
      [{ description: 'Retainer', quantity: 1, unitPrice: 100, taxRate: 10 }],
      { discountPercent: 10 },
    );
    const t = computeTotals(m);
    // subtotal 100.00, tax 10.00, discount 10% of 100 = 10.00
    expect(t.subtotalCents).toBe(10000);
    expect(t.taxTotalCents).toBe(1000);
    expect(t.discountCents).toBe(1000);
    expect(t.grandTotalCents).toBe(10000 - 1000 + 1000);
  });

  it('keeps all-zero totals for an empty line set', () => {
    const t = computeTotals(model([]));
    expect(t.subtotalCents).toBe(0);
    expect(t.taxTotalCents).toBe(0);
    expect(t.discountCents).toBe(0);
    expect(t.grandTotalCents).toBe(0);
  });
});

describe('money helpers', () => {
  it('converts and formats without float drift', () => {
    expect(moneyToCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 → 30
    expect(formatCents(123456)).toBe('1,234.56');
    expect(formatCents(-500)).toBe('-5.00');
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
    expect(formatMoney(2500, 'EUR')).toBe('€25.00');
    expect(currencySymbol('xyz')).toBe('XYZ ');
  });
});

describe('validation', () => {
  it('requires an invoice number, sender and recipient', () => {
    const m = emptyModel();
    m.lines = [{ description: 'x', quantity: 1, unitPrice: 1, taxRate: 0 }];
    const errors = validateModel(m);
    expect(errors.join('|')).toContain('invoice number');
    expect(errors.join('|')).toContain('sender');
    expect(errors.join('|')).toContain('recipient');
  });

  it('rejects a negative price and an out-of-range tax rate', () => {
    const m = model([
      { description: 'a', quantity: -1, unitPrice: -5, taxRate: 120 },
    ]);
    const errors = validateModel(m);
    expect(errors.join('|')).toContain('quantity');
    expect(errors.join('|')).toContain('unit price');
    expect(errors.join('|')).toContain('tax rate');
  });

  it('rejects an empty line list', () => {
    const errors = validateModel(model([]));
    expect(errors.join('|')).toContain('line item');
  });

  it('returns no errors for a valid invoice', () => {
    const m = model([{ description: 'x', quantity: 1, unitPrice: 1, taxRate: 5 }]);
    expect(validateModel(m)).toEqual([]);
  });
});

describe('draft serialisation', () => {
  it('round-trips through JSON losslessly', () => {
    const original = model(
      [{ description: 'Consulting', quantity: 2.5, unitPrice: 120.5, taxRate: 8 }],
      {
        invoiceNumber: 'INV-99',
        discountPercent: 5,
        notes: 'Thanks!',
        logoDataUrl: 'data:image/png;base64,AAAA',
        dueDate: '2026-11-30',
      },
    );
    const parsed = parseDraft(serializeDraft(original));
    expect(parsed).toEqual(original);
  });

  it('returns null for empty, malformed or wrong-version JSON', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('')).toBeNull();
    expect(parseDraft('{oops')).toBeNull();
    expect(parseDraft(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseDraft(JSON.stringify({ ...emptyModel(), version: 1, lines: 'nope' }))).toBeNull();
  });
});

describe('buildPdfBytes', () => {
  it('produces a loadable one-page A4 PDF with totals', async () => {
    const m = model(
      [{ description: 'Design', quantity: 2, unitPrice: 40, taxRate: 10 }],
      { invoiceNumber: 'INV-7', currency: 'EUR', notes: 'Net 30', terms: 'Pay promptly.' },
    );
    const totals = computeTotals(m);
    const bytes = await buildPdfBytes(m, totals);
    expect(bytes.byteLength).toBeGreaterThan(0);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });
});

describe('mountInvoiceGeneratorPanel', () => {
  it('adds and removes line rows and updates the totals preview', () => {
    const root = document.createElement('section');
    root.dataset.invoiceGeneratorWorkbench = '';
    root.innerHTML = `
      <input data-from-name value="Sender" />
      <input data-to-name value="Client" />
      <input data-invoice-number value="INV-1" />
      <input data-currency value="USD" />
      <div data-lines-body></div>
      <button data-add-line></button>
      <input data-logo />
      <div data-logo-preview></div>
      <div data-totals></div>
      <button data-generate></button>
      <button data-save-draft></button>
      <button data-load-draft></button>
      <button data-clear-draft></button>
      <div data-error></div>
      <div data-result-wrap></div>
      <div data-report></div>
    `;
    document.body.append(root);
    mountInvoiceGeneratorPanel(root);

    // Starts with one blank line.
    let rows = root.querySelectorAll<HTMLElement>('[data-line-row]');
    expect(rows.length).toBe(1);

    // Add a line and fill the numbers.
    root.querySelector<HTMLButtonElement>('[data-add-line]')!.click();
    rows = root.querySelectorAll<HTMLElement>('[data-line-row]');
    expect(rows.length).toBe(2);

    const price = rows[0]!.querySelector<HTMLInputElement>('[data-line-price]')!;
    price.value = '10';
    price.dispatchEvent(new Event('input', { bubbles: true }));
    const qty = rows[0]!.querySelector<HTMLInputElement>('[data-line-qty]')!;
    qty.value = '2';
    qty.dispatchEvent(new Event('input', { bubbles: true }));
    const tax = rows[0]!.querySelector<HTMLInputElement>('[data-line-tax]')!;
    tax.value = '5';
    tax.dispatchEvent(new Event('input', { bubbles: true }));

    const totalsText = root.querySelector<HTMLElement>('[data-totals]')!.textContent!;
    expect(totalsText).toContain('Subtotal');
    expect(totalsText).toContain('$20.00');
    expect(totalsText).toContain('$21.00'); // grand total 20.00 + 1.00 tax

    // Remove the second (blank) line.
    rows[1]!.querySelector<HTMLButtonElement>('[data-line-remove]')!.click();
    expect(root.querySelectorAll<HTMLElement>('[data-line-row]').length).toBe(1);
  });

  it('shows a validation error when the invoice is incomplete', () => {
    const root = document.createElement('section');
    root.dataset.invoiceGeneratorWorkbench = '';
    root.innerHTML = `
      <input data-from-name value="" />
      <input data-to-name value="Client" />
      <input data-invoice-number value="INV-1" />
      <input data-currency value="USD" />
      <div data-lines-body></div>
      <button data-add-line></button>
      <input data-logo />
      <div data-logo-preview></div>
      <div data-totals></div>
      <button data-generate></button>
      <button data-save-draft></button>
      <button data-load-draft></button>
      <button data-clear-draft></button>
      <div data-error hidden></div>
      <div data-result-wrap hidden></div>
      <div data-report></div>
    `;
    document.body.append(root);
    mountInvoiceGeneratorPanel(root);

    // Sender name is missing → the generate click shows an error without running the tool.
    const error = root.querySelector<HTMLElement>('[data-error]')!;
    expect(error.hidden).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-generate]')!.click();
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('sender');
  });
});