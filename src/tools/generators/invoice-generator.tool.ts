import type { ToolMeta } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './invoice-generator.meta';

async function run(input: any): Promise<any> {
  const o = resolveOptions(meta, input.options);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  let y = height - 60;
  const left = 50;
  const right = width - 50;

  const draw = (text: string, x: number, yy: number, size: number = 10, options: any = {}) => {
    page.drawText(text, { x, y: yy, size, ...options });
  };

  // Header - Company
  draw(o.companyName, left, y, 18, { bold: true });
  y -= 18;
  draw(o.companyAddress, left, y);
  y -= 18;
  draw(`Email: ${o.companyEmail}`, left, y);
  y -= 35;

  // Invoice Title
  draw('INVOICE', right - 100, y, 24, { bold: true });
  y -= 30;
  draw(`Invoice #: ${o.invoiceNumber}`, right - 100, y);
  y -= 25;

  // Dates
  draw(`Date: ${o.invoiceDate}`, left, y);
  draw(`Due: ${o.dueDate}`, right - 100, y);
  y -= 40;

  // Table header
  draw('Description', left, y, 10, { bold: true });
  draw('Qty', right - 140, y, 10, { bold: true });
  draw('Price', right - 80, y, 10, { bold: true });
  draw('Amount', right - 30, y, 10, { bold: true });
  y -= 5;

  // Table border
  page.drawLine({ start: { x: left, y }, end: { x: right, y } });
  y -= 18;

  let subtotal = 0;
  let items: Array<{ description: string; quantity: number; price: number }> = [];
  try {
    items = JSON.parse(String(o.lineItems || '[]'));
  } catch {
    items = [];
  }
  if (!Array.isArray(items)) items = [];
  for (const item of items) {
    const desc = item.description || '';
    const qty = item.quantity || 0;
    const price = item.price || 0;
    const amount = qty * price;

    draw(desc, left, y);
    draw(qty.toString(), right - 140, y);
    draw(price.toFixed(2), right - 80, y);
    draw(amount.toFixed(2), right - 30, y);

    subtotal += amount;
    y -= 16;
  }

  y -= 10;

  const taxRate = o.taxRate || 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  draw(`Subtotal: $${subtotal.toFixed(2)}`, left, y);
  y -= 16;
  draw(`Tax (${taxRate}%): $${tax.toFixed(2)}`, left, y);
  y -= 16;
  draw(`Total: $${total.toFixed(2)}`, left, y, 12, { bold: true });

  y -= 40;
  draw('Thank you for your business!', left, y, 11);

  const pdfBytes = await pdf.save();
  return {
    type: 'pdf',
    name: `invoice-${o.invoiceNumber || '001'}.pdf`,
    data: pdfBytes,
    credits: [{ name: 'pdf-lib', url: 'https://github.com/Hopding/pdf-lib', license: 'MIT' }],
  };
}

const tool: any = { meta, run };
export default tool;
