import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'gst-calculator',
  name: 'GST Calculator',
  category: 'misc',
  summary: 'Calculate Indian GST (CGST + SGST or IGST) for net or gross amounts with common rate slabs.',
  description:
    'Calculate Goods and Services Tax for Indian transactions. Enter a net or gross amount and the applicable GST rate to compute CGST + SGST (intra-state) or IGST (inter-state). Supports custom rates — no jurisdiction-default claim is made. Common slabs (5%, 12%, 18%, 28%) are provided as presets per the CBIC GST rate schedule (as of 2024); you MUST verify the applicable rate for your HSN/SAC code against the official CBIC portal (https://www.cbic.gov.in). All calculations run locally in your browser.',
  keywords: [
    'gst calculator',
    'gst india',
    'cgst sgst igst',
    'goods and services tax',
    'tax calculator india',
    'gst rate calculator',
    'add gst',
    'remove gst',
    'reverse gst',
    'gst inclusive exclusive',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Calculation mode',
      type: 'select',
      default: 'add',
      choices: [
        { value: 'add', label: 'Add GST (net → gross)' },
        { value: 'remove', label: 'Remove GST (gross → net)' },
      ],
    },
    {
      key: 'transactionType',
      label: 'Transaction type',
      type: 'select',
      default: 'intra',
      choices: [
        { value: 'intra', label: 'Intra-state (CGST + SGST)' },
        { value: 'inter', label: 'Inter-state (IGST)' },
      ],
    },
    {
      key: 'ratePreset',
      label: 'Common GST slabs (select to fill rate)',
      type: 'select',
      default: 'custom',
      choices: [
        { value: 'custom', label: 'Custom rate…' },
        { value: '0', label: '0% — Exempt' },
        { value: '5', label: '5%' },
        { value: '12', label: '12%' },
        { value: '18', label: '18%' },
        { value: '28', label: '28%' },
      ],
    },
    {
      key: 'rate',
      label: 'GST rate (%)',
      type: 'number',
      default: 18,
      min: 0,
      max: 100,
      step: 0.5,
    },
    {
      key: 'amount',
      label: 'Amount',
      type: 'number',
      default: 1000,
      min: 0,
      step: 0.01,
    },
  ],
  examples: [
    { title: 'Add 18% GST to ₹1,000 (intra-state)', options: { mode: 'add', transactionType: 'intra', rate: 18, amount: 1000 } },
    { title: 'Remove 12% GST from ₹1,120 (inter-state)', options: { mode: 'remove', transactionType: 'inter', rate: 12, amount: 1120 } },
    { title: 'Add 28% GST to ₹5,000', options: { mode: 'add', transactionType: 'intra', rate: 28, amount: 5000 } },
  ],
  faq: [
    {
      q: 'What is the difference between CGST/SGST and IGST?',
      a: 'CGST (Central GST) + SGST (State GST) apply to intra-state transactions (within the same state). IGST (Integrated GST) applies to inter-state transactions (between different states). The total tax rate is the same; only the split differs.',
    },
    {
      q: 'Does this tool use official current GST rates?',
      a: 'No. The tool uses the rate you enter. The presets (5%, 12%, 18%, 28%) reflect the standard GST slabs per the CBIC rate schedule as of 2024, but they are NOT defaults for any specific item. You MUST verify the applicable rate for your HSN/SAC code against the official CBIC portal (https://www.cbic.gov.in) or your tax advisor. Rates change via GST Council notifications.',
    },
    {
      q: 'What are the common GST slabs?',
      a: 'Standard slabs per CBIC: 0% (exempt), 5%, 12%, 18%, 28%. Some items have special rates (e.g., 3% for gold, 0.25% for rough diamonds). Compensation cess may apply on top of 28% for luxury/sin goods. Always verify the current rate for your HSN/SAC code.',
    },
    {
      q: 'How does "Remove GST" work?',
      a: 'Reverse calculation: Net Amount = Gross Amount / (1 + Rate/100). Tax Amount = Gross Amount − Net Amount. For intra-state, tax is split equally between CGST and SGST.',
    },
    {
      q: 'Can I calculate for multiple items?',
      a: 'This tool calculates for a single amount. For invoices with multiple line items, calculate each separately or use a dedicated invoice tool (not yet implemented).',
    },
  ],
  related: ['percentage-calculator', 'compound-interest-calculator', 'calculator'],
  status: 'stable',
};