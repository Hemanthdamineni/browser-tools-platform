import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './gst-calculator.meta';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  const transactionType = String(options.transactionType);
  const ratePreset = String(options.ratePreset);
  const rate = ratePreset !== 'custom' ? Number(ratePreset) : (Number(options.rate) || 0);
  const amount = Number(options.amount) || 0;

  if (rate < 0 || rate > 100) {
    return {
      output: JSON.stringify({
        headers: ['Metric', 'Value'],
        rows: [['Error', 'Rate must be between 0 and 100']],
      }),
      render: 'table',
    };
  }

  const rateDecimal = rate / 100;

  let netAmount: number;
  let grossAmount: number;
  let taxAmount: number;
  let cgst: number;
  let sgst: number;
  let igst: number;

  if (mode === 'add') {
    netAmount = amount;
    taxAmount = netAmount * rateDecimal;
    grossAmount = netAmount + taxAmount;
  } else {
    grossAmount = amount;
    netAmount = grossAmount / (1 + rateDecimal);
    taxAmount = grossAmount - netAmount;
  }

  if (transactionType === 'intra') {
    cgst = taxAmount / 2;
    sgst = taxAmount / 2;
    igst = 0;
  } else {
    cgst = 0;
    sgst = 0;
    igst = taxAmount;
  }

  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Mode', mode === 'add' ? 'Add GST (Net → Gross)' : 'Remove GST (Gross → Net)'],
    ['Transaction Type', transactionType === 'intra' ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'],
    ['GST Rate', `${rate}%`],
    ['', ''],
    ['Amounts', ''],
    ['Net Amount (excl. GST)', formatCurrency(netAmount)],
    ['Tax Amount', formatCurrency(taxAmount)],
    ['Gross Amount (incl. GST)', formatCurrency(grossAmount)],
    ['', ''],
    ['Tax Breakdown', ''],
  ];

  if (transactionType === 'intra') {
    rows.push(
      ['CGST (Central GST)', formatCurrency(cgst)],
      ['SGST (State GST)', formatCurrency(sgst)],
      ['IGST (Integrated GST)', '—'],
    );
  } else {
    rows.push(
      ['CGST (Central GST)', '—'],
      ['SGST (State GST)', '—'],
      ['IGST (Integrated GST)', formatCurrency(igst)],
    );
  }

  rows.push(
    ['', ''],
    ['Verification', ''],
    [`Net + Tax = Gross`, `${formatCurrency(netAmount)} + ${formatCurrency(taxAmount)} = ${formatCurrency(grossAmount)}`],
    [`Rate check`, `Tax / Net = ${formatNumber((taxAmount / netAmount) * 100)}%`],
    ['', ''],
    ['⚠ Disclaimer', ''],
    ['Rate Source', 'YOU MUST verify the applicable GST rate for your HSN/SAC code against the official CBIC portal (https://www.cbic.gov.in). This tool uses the rate you enter; no jurisdiction-default claim is made.'],
    ['Rate Changes', 'GST rates are set by the GST Council and change periodically. Always confirm current rates before filing.'],
    ['Professional Advice', 'This calculator is for estimation only. Consult a qualified tax professional for filing.'],
  );

  const output = JSON.stringify({ headers: ['Metric', 'Value'], rows });
  return {
    output,
    render: 'table',
    stats: {
      netAmount,
      grossAmount,
      taxAmount,
      rate,
      cgst,
      sgst,
      igst,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;