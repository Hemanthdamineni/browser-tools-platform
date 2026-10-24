/**
 * Invoice generator — pure logic + panel wiring.
 *
 * The tool is a form: from/to details, invoice number, dates, line items
 * (quantity, unit price, tax rate), notes and an optional logo. The form lives
 * in this panel; the PDF is drawn in `buildPdfBytes` with pdf-lib from the
 * computed model so it can be smoke-tested in Node (jsdom) without a browser.
 *
 * Money is handled in **integer cents** to avoid float drift: every per-line
 * amount, per-line tax and the discount are rounded once to the nearest cent,
 * then summed. All rounding is half-up at two decimals, so the printed totals
 * match the arithmetic a bookkeeper would do by hand.
 *
 * Drafts are kept in `localStorage` only — nothing is ever uploaded.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { downloadBlob } from '@/lib/files';
import { runToolById } from '@/lib/worker/client';
import type { TextRunResult } from '@/lib/types';
import { clearError, renderTextResult, showError } from '../workbench/shared';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Tax rate as a percentage (0–100). */
  taxRate: number;
}

export interface PartyDetails {
  name: string;
  line1: string;
  line2: string;
  city: string;
  postal: string;
  country: string;
  email: string;
  phone: string;
}

export interface InvoiceDraft {
  /** Shape version so a future schema can be migrated. */
  version: 1;
  from: PartyDetails;
  to: PartyDetails;
  invoiceNumber: string;
  /** ISO `YYYY-MM-DD`. */
  issueDate: string;
  /** ISO `YYYY-MM-DD`; empty when there is no due date. */
  dueDate: string;
  currency: string;
  lines: InvoiceLine[];
  /** Percentage discount applied to the subtotal (0–100). */
  discountPercent: number;
  notes: string;
  terms: string;
  /** A `data:` URL for the logo; empty when no logo is set. */
  logoDataUrl: string;
}

export interface LineTotal {
  /** quantity × unit price, rounded to the nearest cent. */
  lineTotalCents: number;
  /** line total × tax rate, rounded to the nearest cent. */
  taxCents: number;
}

export interface InvoiceTotals {
  subtotalCents: number;
  lineTotals: LineTotal[];
  taxTotalCents: number;
  discountCents: number;
  grandTotalCents: number;
}

/** The `localStorage` key the current draft is kept under. */
export const DRAFT_KEY = 'invoice-generator:draft';

/* -------------------------------------------------------------------------- */
/*  Money helpers — integer cents                                             */
/* -------------------------------------------------------------------------- */

/** Round a fractional money value to the nearest cent (half-up). */
export function moneyToCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** `cents → "1,234.56"` (no currency symbol). */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  CAD: '$',
  AUD: '$',
  NZD: '$',
  CHF: 'CHF ',
  SEK: 'kr ',
  NOK: 'kr ',
  DKK: 'kr ',
  PLN: 'zł ',
  INR: '₹',
  BRL: 'R$ ',
  ZAR: 'R ',
};

export function currencySymbol(currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency.toUpperCase()];
  if (sym !== undefined) return sym;
  return `${currency.toUpperCase()} `;
}

export function formatMoney(cents: number, currency: string): string {
  return `${currencySymbol(currency)}${formatCents(cents)}`;
}

/* -------------------------------------------------------------------------- */
/*  Totals — exact integer-cents arithmetic                                   */
/* -------------------------------------------------------------------------- */

/**
 * Compute every total from the line items.
 *
 * Rounding rules (half-up at two decimals):
 *  - each line amount = quantity × unit price, rounded to the nearest cent;
 *  - each line tax = line amount × tax rate %, rounded to the nearest cent;
 *  - the discount = subtotal × discount %, rounded to the nearest cent;
 *  - grand total = subtotal − discount + total tax.
 */
export function computeTotals(model: InvoiceDraft): InvoiceTotals {
  const lineTotals: LineTotal[] = model.lines.map((line) => {
    const lineTotalCents = moneyToCents(line.quantity * line.unitPrice);
    const taxCents = Math.round((lineTotalCents * line.taxRate) / 100);
    return { lineTotalCents, taxCents };
  });
  const subtotalCents = lineTotals.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const taxTotalCents = lineTotals.reduce((sum, l) => sum + l.taxCents, 0);
  const discountCents = Math.round((subtotalCents * model.discountPercent) / 100);
  const grandTotalCents = subtotalCents - discountCents + taxTotalCents;
  return { subtotalCents, lineTotals, taxTotalCents, discountCents, grandTotalCents };
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

/** Validate the model, returning a list of human-readable problems. */
export function validateModel(model: InvoiceDraft): string[] {
  const errors: string[] = [];
  if (!model.invoiceNumber.trim()) errors.push('Enter an invoice number.');
  if (!model.from.name.trim()) errors.push('Enter a sender (from) name.');
  if (!model.to.name.trim()) errors.push('Enter a recipient (to) name.');
  if (!model.currency.trim()) errors.push('Enter a currency code.');

  if (!Number.isFinite(model.discountPercent) || model.discountPercent < 0 || model.discountPercent > 100) {
    errors.push('Discount must be between 0 and 100%.');
  }

  if (!model.lines.length) {
    errors.push('Add at least one line item.');
  } else {
    model.lines.forEach((line, i) => {
      const label = `Line ${i + 1}`;
      if (!line.description.trim()) errors.push(`${label} needs a description.`);
      if (!Number.isFinite(line.quantity) || line.quantity < 0)
        errors.push(`${label}: quantity must be zero or more.`);
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0)
        errors.push(`${label}: unit price must be zero or more.`);
      if (!Number.isFinite(line.taxRate) || line.taxRate < 0 || line.taxRate > 100)
        errors.push(`${label}: tax rate must be between 0 and 100%.`);
    });
  }
  return errors;
}

/* -------------------------------------------------------------------------- */
/*  Draft persistence                                                         */
/* -------------------------------------------------------------------------- */

export function emptyModel(): InvoiceDraft {
  return {
    version: 1,
    from: {
      name: '',
      line1: '',
      line2: '',
      city: '',
      postal: '',
      country: '',
      email: '',
      phone: '',
    },
    to: {
      name: '',
      line1: '',
      line2: '',
      city: '',
      postal: '',
      country: '',
      email: '',
      phone: '',
    },
    invoiceNumber: '',
    issueDate: '',
    dueDate: '',
    currency: 'USD',
    lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    discountPercent: 0,
    notes: '',
    terms: '',
    logoDataUrl: '',
  };
}

/** Serialise a draft to the JSON string stored in `localStorage`. */
export function serializeDraft(model: InvoiceDraft): string {
  return JSON.stringify(model);
}

const PARTY_KEYS = ['name', 'line1', 'line2', 'city', 'postal', 'country', 'email', 'phone'] as const;

function isParty(v: unknown): v is PartyDetails {
  if (!v || typeof v !== 'object') return false;
  const rec = v as Record<string, unknown>;
  return PARTY_KEYS.every((k) => typeof rec[k] === 'string');
}

function isLine(v: unknown): v is InvoiceLine {
  if (!v || typeof v !== 'object') return false;
  const rec = v as Record<string, unknown>;
  return (
    typeof rec.description === 'string' &&
    typeof rec.quantity === 'number' &&
    typeof rec.unitPrice === 'number' &&
    typeof rec.taxRate === 'number'
  );
}

/** Parse a stored draft, returning `null` when it is missing or malformed. */
export function parseDraft(json: string | null | undefined): InvoiceDraft | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<InvoiceDraft>;
    if (v.version !== 1) return null;
    if (!isParty(v.from) || !isParty(v.to)) return null;
    if (!Array.isArray(v.lines) || !v.lines.every(isLine)) return null;
    if (
      typeof v.invoiceNumber !== 'string' ||
      typeof v.issueDate !== 'string' ||
      typeof v.dueDate !== 'string' ||
      typeof v.currency !== 'string' ||
      typeof v.discountPercent !== 'number' ||
      typeof v.notes !== 'string' ||
      typeof v.terms !== 'string' ||
      typeof v.logoDataUrl !== 'string'
    ) {
      return null;
    }
    return v as InvoiceDraft;
  } catch {
    return null;
  }
}

/** Read a value from `localStorage` without letting a blocked store throw. */
export function readDraft(storage: Storage): InvoiceDraft | null {
  try {
    return parseDraft(storage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

/** Write a value to `localStorage`, ignoring a blocked or full store. */
export function saveDraft(storage: Storage, model: InvoiceDraft): void {
  try {
    storage.setItem(DRAFT_KEY, serializeDraft(model));
  } catch {
    /* a blocked or full localStorage is not fatal — the invoice still works */
  }
}

export function clearDraft(storage: Storage): void {
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/*  PDF drawing (pure — no DOM, smoke-testable with pdf-lib)                  */
/* -------------------------------------------------------------------------- */

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

const GREY = rgb(0.35, 0.35, 0.35);
const DARK = rgb(0.15, 0.15, 0.15);
const LIGHT = rgb(0.94, 0.94, 0.94);
const ACCENT = rgb(0.2, 0.35, 0.55);

/** Wrap `text` into lines that fit `maxWidth` at `size` (best-effort on spaces). */
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

function drawMultiline(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  color = DARK,
  lineGap = 1.2,
): void {
  const lines = wrapText(font, text, size, maxWidth);
  lines.forEach((line, i) => {
    page.drawText(line, {
      x,
      y: y - i * size * lineGap,
      size,
      font,
      color,
    });
  });
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(mo) - 1] ?? mo;
  return `${month} ${Number(d)} ${y}`;
}

/** Embed the logo from a `data:` URL onto the page, or return `null` when it cannot load. */
async function embedLogo(
  doc: PDFDocument,
  page: PDFPage,
  dataUrl: string,
): Promise<{ width: number } | null> {
  if (!dataUrl) return null;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1]!.toLowerCase();
  const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
  try {
    const image =
      mime === 'image/png'
        ? await doc.embedPng(bytes)
        : mime === 'image/jpeg' || mime === 'image/jpg'
          ? await doc.embedJpg(bytes)
          : null;
    if (!image) return null;
    const maxW = 110;
    const maxH = 60;
    const scale = Math.min(maxW / image.width, maxH / image.height, 1);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: MARGIN, y: PAGE_H - MARGIN - h, width: w, height: h });
    return { width: w };
  } catch {
    return null;
  }
}

/**
 * Draw an A4 invoice PDF from a computed model. This is pure layout — call it
 * with the output of `computeTotals` so the drawing never does arithmetic.
 * Returns the raw PDF bytes.
 */
export async function buildPdfBytes(model: InvoiceDraft, totals: InvoiceTotals): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(model.invoiceNumber || 'Invoice');
  doc.setProducer('Invoice Generator');
  doc.setCreator('Invoice Generator');
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const currency = model.currency || 'USD';

  // Logo top-left; the sender name sits beneath it (or at the top when absent).
  const logo = await embedLogo(doc, page, model.logoDataUrl);
  const nameY = logo ? PAGE_H - MARGIN - 78 : PAGE_H - MARGIN - 14;
  drawMultiline(page, bold, model.from.name || ' ', MARGIN, nameY, 16, CONTENT_W * 0.6);

  page.drawText('INVOICE', {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize('INVOICE', 22),
    y: PAGE_H - MARGIN - 2,
    size: 22,
    font: bold,
    color: ACCENT,
  });
  const metaY = PAGE_H - MARGIN - 34;
  const metaLines = [
    `Invoice # ${model.invoiceNumber || '—'}`,
    `Issued: ${formatDate(model.issueDate) || '—'}`,
    model.dueDate ? `Due: ${formatDate(model.dueDate)}` : '',
  ].filter(Boolean);
  metaLines.forEach((line, i) => {
    page.drawText(line, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(line, 10),
      y: metaY - i * 14,
      size: 10,
      font,
      color: GREY,
    });
  });

  // From / To columns.
  const blockTop = PAGE_H - MARGIN - 118;
  const colW = CONTENT_W / 2 - 12;
  drawMultiline(page, bold, 'From', MARGIN, blockTop, 10, colW, GREY);
  const fromText = [model.from.name, model.from.line1, model.from.line2]
    .filter((s) => s.trim())
    .join('\n');
  drawMultiline(page, font, fromText || '—', MARGIN, blockTop - 16, 10, colW);
  if (model.from.email || model.from.phone) {
    const contact = [model.from.email, model.from.phone].filter(Boolean).join(' · ');
    drawMultiline(page, font, contact, MARGIN, blockTop - 16 - 8 * 4, 9, colW, GREY);
  }

  const toX = MARGIN + colW + 24;
  drawMultiline(page, bold, 'Bill To', toX, blockTop, 10, colW, GREY);
  const toText = [model.to.name, model.to.line1, model.to.line2]
    .filter((s) => s.trim())
    .join('\n');
  drawMultiline(page, font, toText || '—', toX, blockTop - 16, 10, colW);
  if (model.to.email || model.to.phone) {
    const contact = [model.to.email, model.to.phone].filter(Boolean).join(' · ');
    drawMultiline(page, font, contact, toX, blockTop - 16 - 8 * 4, 9, colW, GREY);
  }

  // Line items table.
  const tableTop = blockTop - 92;
  const headerY = tableTop + 22;
  const rowH = 20;
  const cols = [
    { label: 'Description', align: 'left' as const, x: MARGIN, w: CONTENT_W * 0.38 },
    { label: 'Qty', align: 'right' as const, x: MARGIN + CONTENT_W * 0.38, w: CONTENT_W * 0.08 },
    { label: 'Unit Price', align: 'right' as const, x: MARGIN + CONTENT_W * 0.46, w: CONTENT_W * 0.18 },
    { label: 'Tax', align: 'right' as const, x: MARGIN + CONTENT_W * 0.64, w: CONTENT_W * 0.1 },
    { label: 'Amount', align: 'right' as const, x: MARGIN + CONTENT_W * 0.74, w: CONTENT_W * 0.26 },
  ];

  // Header bar.
  page.drawRectangle({ x: MARGIN, y: headerY, width: CONTENT_W, height: rowH, color: LIGHT });
  for (const c of cols) {
    const text = c.label;
    const tx = c.align === 'right' ? c.x + c.w - font.widthOfTextAtSize(text, 9) : c.x + 4;
    page.drawText(text, { x: tx, y: headerY + 6, size: 9, font: bold, color: GREY });
  }

  let y = headerY - rowH;
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 0.5, color: LIGHT });
  model.lines.forEach((line, i) => {
    const t = totals.lineTotals[i]!;
    const descLines = wrapText(font, line.description || '—', 9, cols[0]!.w - 8);
    const blockH = Math.max(rowH, descLines.length * 11 + 6);
    // stripe every other row
    if (i % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - blockH, width: CONTENT_W, height: blockH, color: LIGHT });
    }
    drawMultiline(page, font, line.description || '—', MARGIN + 4, y - 3, 9, cols[0]!.w - 8);
    const cells: Array<{ text: string; col: (typeof cols)[number] }> = [
      {
        text: Number.isInteger(line.quantity)
          ? String(line.quantity)
          : String(parseFloat(line.quantity.toFixed(3))),
        col: cols[1]!,
      },
      { text: formatMoney(moneyToCents(line.unitPrice), currency), col: cols[2]! },
      { text: `${line.taxRate}%`, col: cols[3]! },
      { text: formatMoney(t.lineTotalCents, currency), col: cols[4]! },
    ];
    for (const cell of cells) {
      const text = cell.text;
      const c = cell.col;
      const tx = c.align === 'right' ? c.x + c.w - font.widthOfTextAtSize(text, 9) - 4 : c.x + 4;
      page.drawText(text, { x: tx, y: y - 1, size: 9, font });
    }
    y -= blockH;
  });
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 0.5, color: LIGHT });

  // Totals block (right-aligned).
  const totalsX = MARGIN + CONTENT_W * 0.56;
  const totalsW = CONTENT_W * 0.44;
  const rowHeight = 16;
  const rows: Array<[string, string, boolean]> = [
    ['Subtotal', formatMoney(totals.subtotalCents, currency), false],
    ['Total tax', formatMoney(totals.taxTotalCents, currency), false],
  ];
  if (model.discountPercent > 0) {
    rows.push([`Discount (${model.discountPercent}%)`, `−${formatMoney(totals.discountCents, currency)}`, false]);
  }
  rows.push(['Grand total', formatMoney(totals.grandTotalCents, currency), true]);
  rows.forEach(([label, value, strong], i) => {
    const ry = y - 10 - i * rowHeight;
    if (strong) {
      page.drawRectangle({ x: totalsX, y: ry - 4, width: totalsW, height: rowHeight, color: LIGHT });
    }
    page.drawText(label, { x: totalsX + 6, y: ry, size: 10, font: strong ? bold : font, color: DARK });
    page.drawText(value, {
      x: totalsX + totalsW - 6 - (strong ? bold : font).widthOfTextAtSize(value, 10),
      y: ry,
      size: 10,
      font: strong ? bold : font,
      color: strong ? ACCENT : DARK,
    });
  });

  // Notes + terms.
  let footerY = y - rows.length * rowHeight - 34;
  if (model.notes.trim()) {
    drawMultiline(page, bold, 'Notes', MARGIN, footerY, 10, CONTENT_W, GREY);
    drawMultiline(page, font, model.notes, MARGIN, footerY - 14, 9, CONTENT_W);
    footerY -= 14 + wrapText(font, model.notes, 9, CONTENT_W).length * 11 + 10;
  }
  if (model.terms.trim()) {
    drawMultiline(page, bold, 'Terms', MARGIN, footerY, 10, CONTENT_W, GREY);
    drawMultiline(page, font, model.terms, MARGIN, footerY - 14, 9, CONTENT_W);
  }

  return doc.save();
}

/* -------------------------------------------------------------------------- */
/*  Panel DOM wiring                                                          */
/* -------------------------------------------------------------------------- */

function val(root: ParentNode, selector: string): string {
  const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
  return el ? el.value : '';
}

function num(root: ParentNode, selector: string): number {
  const n = Number.parseFloat(val(root, selector));
  return Number.isFinite(n) ? n : 0;
}

/** Mount the invoice generator into a `[data-invoice-generator-workbench]` element. */
export function mountInvoiceGeneratorPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'invoice-generator';
  const linesBody = root.querySelector<HTMLElement>('[data-lines-body]')!;
  const addLineBtn = root.querySelector<HTMLButtonElement>('[data-add-line]')!;
  const logoInput = root.querySelector<HTMLInputElement>('[data-logo]')!;
  const logoPreview = root.querySelector<HTMLElement>('[data-logo-preview]')!;
  const totalsHost = root.querySelector<HTMLElement>('[data-totals]')!;
  const generateBtn = root.querySelector<HTMLButtonElement>('[data-generate]')!;
  const saveBtn = root.querySelector<HTMLButtonElement>('[data-save-draft]')!;
  const loadBtn = root.querySelector<HTMLButtonElement>('[data-load-draft]')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear-draft]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const reportEl = root.querySelector<HTMLElement>('[data-report]')!;

  if (!linesBody || !addLineBtn || !logoInput || !logoPreview || !totalsHost || !generateBtn) return;

  let logoDataUrl = '';

  function lineRow(line: InvoiceLine): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'grid items-center gap-2';
    row.style.gridTemplateColumns = '1fr 64px 96px 64px auto';
    row.dataset.lineRow = '';
    row.innerHTML = `
      <input class="field" data-line-desc placeholder="Description" value="${escapeAttr(line.description)}" />
      <input class="field" data-line-qty type="number" min="0" step="any" value="${line.quantity}" aria-label="Quantity" />
      <input class="field" data-line-price type="number" min="0" step="0.01" value="${line.unitPrice}" aria-label="Unit price" />
      <input class="field" data-line-tax type="number" min="0" max="100" step="any" value="${line.taxRate}" aria-label="Tax rate" />
      <button type="button" class="btn btn-ghost" data-line-remove aria-label="Remove line">Remove</button>
    `;
    row.querySelector<HTMLButtonElement>('[data-line-remove]')!.addEventListener('click', () => {
      row.remove();
      renderTotals();
    });
    for (const input of row.querySelectorAll<HTMLElement>('input')) {
      input.addEventListener('input', renderTotals);
    }
    return row;
  }

  function collectLines(): InvoiceLine[] {
    return Array.from(linesBody.querySelectorAll<HTMLElement>('[data-line-row]')).map((row) => ({
      description: val(row, '[data-line-desc]'),
      quantity: num(row, '[data-line-qty]'),
      unitPrice: num(row, '[data-line-price]'),
      taxRate: num(row, '[data-line-tax]'),
    }));
  }

  function collectModel(): InvoiceDraft {
    return {
      version: 1,
      from: {
        name: val(root, '[data-from-name]'),
        line1: val(root, '[data-from-line1]'),
        line2: val(root, '[data-from-line2]'),
        city: val(root, '[data-from-city]'),
        postal: val(root, '[data-from-postal]'),
        country: val(root, '[data-from-country]'),
        email: val(root, '[data-from-email]'),
        phone: val(root, '[data-from-phone]'),
      },
      to: {
        name: val(root, '[data-to-name]'),
        line1: val(root, '[data-to-line1]'),
        line2: val(root, '[data-to-line2]'),
        city: val(root, '[data-to-city]'),
        postal: val(root, '[data-to-postal]'),
        country: val(root, '[data-to-country]'),
        email: val(root, '[data-to-email]'),
        phone: val(root, '[data-to-phone]'),
      },
      invoiceNumber: val(root, '[data-invoice-number]'),
      issueDate: val(root, '[data-issue-date]'),
      dueDate: val(root, '[data-due-date]'),
      currency: val(root, '[data-currency]') || 'USD',
      lines: collectLines(),
      discountPercent: num(root, '[data-discount]'),
      notes: val(root, '[data-notes]'),
      terms: val(root, '[data-terms]'),
      logoDataUrl,
    };
  }

  function renderTotals(): void {
    const model = collectModel();
    const totals = computeTotals(model);
    const currency = model.currency || 'USD';
    const lines = [
      ['Subtotal', formatMoney(totals.subtotalCents, currency)],
      ['Total tax', formatMoney(totals.taxTotalCents, currency)],
    ];
    if (model.discountPercent > 0) {
      lines.push([`Discount (${model.discountPercent}%)`, `−${formatMoney(totals.discountCents, currency)}`]);
    }
    lines.push(['Grand total', formatMoney(totals.grandTotalCents, currency)]);
    totalsHost.innerHTML = '';
    lines.forEach(([label, value], i) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-3 text-sm';
      const strong = i === lines.length - 1;
      row.style.fontWeight = strong ? '600' : '400';
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      const valueEl = document.createElement('span');
      valueEl.className = 'tabular-nums';
      valueEl.textContent = value;
      row.append(labelEl, valueEl);
      totalsHost.append(row);
    });
  }

  function renderLines(lines: InvoiceLine[]): void {
    linesBody.innerHTML = '';
    const rows = lines.length ? lines : [emptyModel().lines[0]!];
    rows.forEach((line) => linesBody.append(lineRow(line)));
  }

  function applyModel(model: InvoiceDraft): void {
    logoDataUrl = model.logoDataUrl || '';
    const set = (selector: string, value: string) => {
      const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
      if (el) el.value = value;
    };
    set('[data-from-name]', model.from.name);
    set('[data-from-line1]', model.from.line1);
    set('[data-from-line2]', model.from.line2);
    set('[data-from-city]', model.from.city);
    set('[data-from-postal]', model.from.postal);
    set('[data-from-country]', model.from.country);
    set('[data-from-email]', model.from.email);
    set('[data-from-phone]', model.from.phone);
    set('[data-to-name]', model.to.name);
    set('[data-to-line1]', model.to.line1);
    set('[data-to-line2]', model.to.line2);
    set('[data-to-city]', model.to.city);
    set('[data-to-postal]', model.to.postal);
    set('[data-to-country]', model.to.country);
    set('[data-to-email]', model.to.email);
    set('[data-to-phone]', model.to.phone);
    set('[data-invoice-number]', model.invoiceNumber);
    set('[data-issue-date]', model.issueDate);
    set('[data-due-date]', model.dueDate);
    set('[data-currency]', model.currency);
    set('[data-discount]', String(model.discountPercent));
    set('[data-notes]', model.notes);
    set('[data-terms]', model.terms);
    renderLines(model.lines);
    renderLogoPreview();
    renderTotals();
  }

  function renderLogoPreview(): void {
    logoPreview.innerHTML = '';
    if (!logoDataUrl) {
      logoPreview.textContent = 'No logo selected.';
      return;
    }
    const img = document.createElement('img');
    img.src = logoDataUrl;
    img.alt = 'Invoice logo';
    img.className = 'max-h-16 rounded border';
    logoPreview.append(img);
  }

  addLineBtn.addEventListener('click', () => {
    linesBody.append(lineRow({ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }));
    renderTotals();
  });

  logoInput.addEventListener('change', () => {
    const file = logoInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = String(reader.result ?? '');
      renderLogoPreview();
      renderTotals();
    };
    reader.readAsDataURL(file);
  });

  for (const field of root.querySelectorAll<HTMLElement>('input, textarea, select')) {
    field.addEventListener('input', () => renderTotals());
    field.addEventListener('change', () => renderTotals());
  }

  generateBtn.addEventListener('click', () => {
    clearError(errorBox);
    if (resultWrap) resultWrap.hidden = true;
    const model = collectModel();
    const errors = validateModel(model);
    if (errors.length) {
      showError(errorBox, errors[0]!);
      return;
    }
    void (async () => {
      try {
        const result = await runToolById<TextRunResult>(toolId, {
          text: '',
          options: { model: serializeDraft(model), outputName: `${model.invoiceNumber || 'invoice'}.pdf` },
        });
        // The tool returns a data URL; turn it into a blob and download it.
        const match = /^data:([^;]+);base64,(.*)$/s.exec(result.output);
        if (!match) throw new Error('The PDF could not be generated.');
        const binary = atob(match[2]!);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        downloadBlob(new Blob([bytes.buffer], { type: 'application/pdf' }), result.filename ?? 'invoice.pdf');
        if (resultWrap) resultWrap.hidden = false;
        if (reportEl) {
          renderTextResult(reportEl, { output: `${result.notes?.join('\n') ?? ''}`, render: 'text' });
        }
        clearError(errorBox);
      } catch (err) {
        const e = err as Error & { hint?: string };
        showError(errorBox, e.message || 'The invoice could not be generated.', e.hint);
      }
    })();
  });

  saveBtn?.addEventListener('click', () => {
    saveDraft(window.localStorage, collectModel());
    const ok = root.querySelector<HTMLElement>('[data-draft-status]');
    if (ok) ok.textContent = 'Draft saved.';
  });
  loadBtn?.addEventListener('click', () => {
    const model = readDraft(window.localStorage);
    if (model) {
      applyModel(model);
      const ok = root.querySelector<HTMLElement>('[data-draft-status]');
      if (ok) ok.textContent = 'Draft loaded.';
    } else {
      const ok = root.querySelector<HTMLElement>('[data-draft-status]');
      if (ok) ok.textContent = 'No saved draft.';
    }
  });
  clearBtn?.addEventListener('click', () => {
    clearDraft(window.localStorage);
    applyModel(emptyModel());
    const ok = root.querySelector<HTMLElement>('[data-draft-status]');
    if (ok) ok.textContent = 'Draft cleared.';
  });

  // Initial render: start from an empty invoice with one blank line.
  renderLines(emptyModel().lines);
  renderLogoPreview();
  renderTotals();
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}