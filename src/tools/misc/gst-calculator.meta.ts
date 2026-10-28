import type { ToolMeta } from '@/lib/types';

/**
 * India's GST rate slabs.
 *
 * The table mirrors the rate schedules published on the CBIC GST portal and
 * was checked on {@link RATES_AS_OF}. Any rate can be typed in as well, because
 * the correct slab depends on the HSN code — this list is a convenience, not a
 * classification.
 *
 * To refresh the table, edit GST_SLABS, RATES_AS_OF and RATES_SOURCE here —
 * the tool module imports them from this file.
 */
export interface GstSlab {
  /** GST rate in percent. */
  rate: number;
  /** Short name used in the rate picker and the notes. */
  label: string;
  /** What the rate applies to. */
  appliesTo: string;
}

export const GST_SLABS: readonly GstSlab[] = [
  {
    rate: 0,
    label: 'Nil / exempt',
    appliesTo:
      'Goods and services exempt from GST (fresh produce, unbranded staples, many medicines).',
  },
  {
    rate: 0.25,
    label: 'Rough diamonds & unworked precious stones',
    appliesTo: 'Rough diamonds and other unworked precious or semi-precious stones (Schedule V).',
  },
  {
    rate: 1.5,
    label: 'Job work of precious metals',
    appliesTo: 'Job work services in relation to precious metals and stones (Schedule VI).',
  },
  {
    rate: 3,
    label: 'Gold, silver & jewellery',
    appliesTo: 'Gold, silver, platinum, precious-metal jewellery, pearls and coins (Schedule IV).',
  },
  {
    rate: 5,
    label: '5% slab',
    appliesTo: 'Goods and services listed in the CBIC 5% schedule.',
  },
  {
    rate: 18,
    label: '18% slab',
    appliesTo: 'Goods and services listed in the CBIC 18% schedule.',
  },
  {
    rate: 40,
    label: '40% de-merit rate',
    appliesTo:
      'Sin goods and luxury items that moved to the de-merit rate when the 12% and 28% slabs were withdrawn in September 2025.',
  },
];

/** Date on which the slab table above was last checked against official sources. */
export const RATES_AS_OF = '2026-10-28';

/** Primary official source for the slab structure. */
export const RATES_SOURCE = 'https://cbic-gst.gov.in/gst-goods-services-rates.html';

/** Further official sources (the portal pages behind the slabs). */
export const RATES_SOURCES: readonly string[] = [
  'https://cbic-gst.gov.in/gst-goods-services-rates.html',
  'https://www.cbic.gov.in/',
  'https://gstcouncil.gov.in/',
];

export const meta: ToolMeta = {
  id: 'gst-calculator',
  name: 'GST Calculator',
  category: 'misc',
  summary:
    'Add or remove GST and split the tax into CGST/SGST or IGST, using the current Indian slab rates.',
  description:
    'Add GST to a price or take it back out of a GST-inclusive total, and see the tax split into CGST and SGST for an intra-state supply or IGST for an inter-state supply. The picker offers the common 0, 0.25, 1.5, 3, 5, 12, 18 and 28 percent slabs and accepts any custom rate; the correct slab for goods or services depends on the HSN code, so confirm it on the CBIC portal. This is a generic calculator, not financial advice.',
  keywords: [
    'gst calculator',
    'gst',
    'cgst',
    'sgst',
    'igst',
    'cgst sgst igst',
    'india tax',
    'add gst',
    'remove gst',
    'gst inclusive',
    'gst exclusive',
    'gst slab rates',
    'gst rate calculator',
    'tax calculator india',
    'invoice gst',
    'gst breakdown',
    'intra state gst',
    'inter state gst',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Calculation',
      type: 'select',
      default: 'add',
      choices: [
        { value: 'add', label: 'Add GST to a price (tax exclusive)' },
        { value: 'remove', label: 'Remove GST from a price (tax inclusive)' },
      ],
      help: '“Add” treats the amount as the price before GST; “remove” treats it as the GST-inclusive total.',
    },
    {
      key: 'amount',
      label: 'Amount (\u20b9)',
      type: 'number',
      default: 1000,
      min: 0,
      step: 0.01,
      help: 'The price before GST in “add” mode, the GST-inclusive total in “remove” mode. Typing a number in the text box overrides it.',
    },
    {
      key: 'rate',
      label: 'GST rate',
      type: 'select',
      default: '18',
      choices: [
        { value: '0', label: 'Nil / exempt — 0%' },
        { value: '0.25', label: '0.25% — rough diamonds & unworked precious stones' },
        { value: '1.5', label: '1.5% — job work of precious metals' },
        { value: '3', label: '3% — gold, silver & jewellery' },
        { value: '5', label: '5% — merit rate' },
        { value: '18', label: '18% — standard rate' },
        { value: '40', label: '40% — de-merit rate (sin & luxury goods)' },
        { value: 'custom', label: 'Custom rate\u2026' },
      ],
      help: 'Slabs notified in Notification No. 9/2025-Central Tax (Rate) and 9/2025-Integrated Tax (Rate).',
    },
    {
      key: 'customRate',
      label: 'Custom GST rate (%)',
      type: 'number',
      default: 18,
      min: 0,
      step: 0.01,
      showWhen: { key: 'rate', value: 'custom' },
      help: 'Any rate from 0% to 100%.',
    },
    {
      key: 'supply',
      label: 'Type of supply',
      type: 'select',
      default: 'intra',
      choices: [
        { value: 'intra', label: 'Intra-state — CGST + SGST' },
        { value: 'inter', label: 'Inter-state — IGST' },
      ],
      help: 'A supply inside one state is charged CGST and SGST, each half the rate. A supply across states (or an export) is charged IGST at the full rate.',
    },
  ],
  examples: [
    {
      title: 'Add 18% GST to \u20b910,000 (intra-state)',
      input: '',
      options: { mode: 'add', amount: 10000, rate: '18', supply: 'intra' },
    },
    {
      title: 'Remove 18% GST from a \u20b911,800 invoice',
      input: '',
      options: { mode: 'remove', amount: 11800, rate: '18', supply: 'intra' },
    },
    {
      title: 'Inter-state sale at the 40% de-merit rate',
      input: '',
      options: { mode: 'add', amount: 50000, rate: '40', supply: 'inter' },
    },
    {
      title: 'Use any text input — options drive the calculation',
      input: 'type something here — options drive the calculation',
      options: { mode: 'add', amount: 2500, rate: '5', supply: 'intra' },
    },
  ],
  related: [
    'percentage-calculator',
    'tip-calculator',
    'calculator',
    'loan-calculator',
    'compound-interest-calculator',
    'unit-convert',
  ],
  status: 'beta',
  updated: '2026-10-21',
};
