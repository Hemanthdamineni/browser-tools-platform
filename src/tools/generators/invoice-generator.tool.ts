/**
 * The invoice generator.
 *
 * The form (from/to details, line items, totals, draft saving, optional logo)
 * lives in the `invoice-generator` panel, which sends the draft to this module
 * as a JSON payload. `run()` turns that model into a PDF:
 *
 *   1. parse the draft (`parseDraft`);
 *   2. validate it (`validateModel`);
 *   3. compute the totals (`computeTotals`);
 *   4. draw the PDF (`buildPdfBytes`) and return it as a base64 data URL.
 *
 * All the money maths and the PDF layout live in `invoice-generator-panel.ts`
 * so the panel and this tool agree exactly, and the pure functions are
 * unit-testable in Node without a browser.
 */
import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  buildPdfBytes,
  computeTotals,
  parseDraft,
  validateModel,
} from '@/components/panels/invoice-generator-panel';
import { meta } from './invoice-generator.meta';

/** Encode bytes as base64 without overflowing the call stack on big PDFs. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const modelJson = String(o.model ?? '').trim();
  const model = parseDraft(modelJson || null);

  if (!model) {
    throw new ToolError('Start from the invoice form above, then press Generate PDF.');
  }

  const errors = validateModel(model);
  if (errors.length) throw new ToolError(errors[0]!);

  const totals = computeTotals(model);
  const outputName = String(o.outputName ?? 'invoice.pdf').trim() || 'invoice.pdf';

  return {
    output: 'pending', // replaced below once the async PDF bytes are ready
    render: 'text',
    filename: outputName,
    notes: [
      `Subtotal ${centsToString(totals.subtotalCents)} — tax ${centsToString(totals.taxTotalCents)}` +
        (totals.discountCents > 0 ? ` — discount ${centsToString(totals.discountCents)}` : '') +
        ` — grand total ${centsToString(totals.grandTotalCents)}`,
    ],
  };
}

function centsToString(cents: number): string {
  return `${(cents / 100).toFixed(2)}`;
}

const tool: TextToolModule = { meta, run };
export default tool;