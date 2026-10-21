import type { ToolMeta } from '@/lib/types';

/**
 * India's current GST rate slabs.
 *
 * Verified on 21 October 2026 against official sources:
 *  - PIB, "Recommendations of the 56th meeting of the GST Council" (3 Sep 2025):
 *    https://pib.gov.in/PressReleasePage.aspx?PRID=2163555
 *  - CBIC Notification No. 9/2025-Central Tax (Rate) and Notification No.
 *    9/2025-Integrated Tax (Rate), both dated 17 Sep 2025, in force from
 *    22 Sep 2025 (CGST schedules: 2.5 / 9 / 20 / 1.5 / 0.125 / 0.75%;
 *    IGST schedules: 5 / 18 / 40 / 3 / 1.5 / 0.25%).
 *  - As amended by Notification No. 19/2025-(Central/Integrated Tax) (Rate),
 *    31 Dec 2025 (bidi to 18%; pan masala and tobacco to 40%, w.e.f.
 *    1 Feb 2026) and Notification No. 01/2026-(Central/Integrated Tax)
 *    (Rate), 30 Apr 2026 (Finance Act, 2026 transposition — no slab change).
 *  - The 57th GST Council (8 Oct 2026) made process reforms only; rates
 *    were left unchanged.
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
    label: 'Merit rate',
    appliesTo:
      'The merit rate for everyday goods and services — packaged food, medicines, transport and most manufacturing.',
  },
  {
    rate: 18,
    label: 'Standard rate',
    appliesTo: 'The standard rate for most goods and services.',
  },
  {
    rate: 40,
    label: 'De-merit rate',
    appliesTo:
      'A narrow set of sin and luxury goods — pan masala, tobacco and cigarettes, aerated drinks, large cars, yachts and private aircraft.',
  },
];

/** Date on which the slab table above was last checked against official sources. */
export const RATES_AS_OF = '2026-10-21';

/** Primary official source for the current slab structure. */
export const RATES_SOURCE = 'https://pib.gov.in/PressReleasePage.aspx?PRID=2163555';

/** Further official sources (the rate notifications themselves). */
export const RATES_SOURCES: readonly string[] = [
  'https://gstcouncil.gov.in/sites/default/files/2025-09/press_release_press_information_bureau_0.pdf',
  'https://taxinformation.cbic.gov.in/view-pdf/1010436/ENG/Notifications',
  'https://taxinformation.cbic.gov.in/view-pdf/1010431/ENG/Notifications',
  'https://taxinformation.cbic.gov.in/view-pdf/1010535/ENG/Notifications',
  'https://taxinformation.cbic.gov.in/view-pdf/1010642/ENG/Notifications',
];

export const meta: ToolMeta = {
  id: 'gst-calculator',
  name: 'GST Calculator',
  category: 'misc',
  summary:
    'Add or remove GST and split the tax into CGST/SGST or IGST, using the current Indian slab rates.',
  description:
    'Add GST to a price or take it back out of a GST-inclusive total, and see the tax split into CGST and SGST for an intra-state supply or IGST for an inter-state supply. The rate picker carries India\u2019s current slabs \u2014 the 5% merit rate, the 18% standard rate, the 40% de-merit rate and the 0.25%, 1.5% and 3% special rates \u2014 verified against official GST Council and CBIC notifications on 21 October 2026. This is a generic calculator, not financial advice.',
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
      max: 100,
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
  faq: [
    {
      q: 'Which GST rates are current, and where were they verified?',
      a: `Rates verified on ${RATES_AS_OF} — source: ${RATES_SOURCE}. The 56th GST Council (3 September 2025) replaced the old 5/12/18/28% slabs with a 5% “merit rate”, an 18% “standard rate” and a special 40% “de-merit rate” for a narrow set of sin and luxury goods, effective 22 September 2025. The special rates are unchanged: 3% on gold, silver and jewellery, 1.5% on job work of precious metals and 0.25% on rough diamonds. The Finance Act, 2026 amended the GST Act’s definition of “interest” only — Notification No. 01/2026-(Central/Integrated Tax) (Rate) of 30 April 2026 transposed it without touching any slab — and the 57th GST Council (8 October 2026) made process reforms with rates unchanged. The gazette notifications themselves are on the CBIC tax portal, for example https://taxinformation.cbic.gov.in/view-pdf/1010436/ENG/Notifications (Notification No. 9/2025-Central Tax (Rate)).`,
    },
    {
      q: 'Is this financial advice?',
      a: 'No. This is a generic arithmetic helper that applies a rate you choose. It does not tell you which rate applies to a particular product or service, and it ignores input tax credit, compensation cess, anti-profiteering rules and rounding rules that a real invoice may apply. Check the current CBIC rate notifications for your HSN code before you invoice anything.',
    },
    {
      q: 'When is CGST and SGST charged, and when is IGST charged?',
      a: 'A supply of goods or services inside a single state (or union territory) is an intra-state supply: the tax is split evenly between CGST (central) and SGST (state), so an 18% rate becomes 9% + 9%. A supply across two states, or an export, is an inter-state supply: IGST is charged at the full rate and the tax is later shared between the centre and the states.',
    },
    {
      q: 'How is a GST-inclusive price worked backwards?',
      a: 'The taxable value is the inclusive total divided by (1 + rate). A \u20b911,800 invoice at 18% therefore has a taxable value of \u20b911,800 ÷ 1.18 = \u20b910,000 and \u20b9180 of GST. That is the standard way a GST portal or an invoice works the number back.',
    },
    {
      q: 'How is rounding handled?',
      a: 'Every tax component is computed on the taxable value and rounded to the nearest paisa (2 decimal places, halves rounded up). The gross amount is then the taxable value plus the rounded components, so it can differ from a hand-worked total by up to \u20b90.01. In an intra-state supply CGST and SGST are always equal — each is exactly half of the GST amount.',
    },
    {
      q: 'Which rate applies to my product or service?',
      a: 'That depends on the HSN code of the goods or the nature of the service, and this calculator deliberately does not guess. Use the rate picker for arithmetic and check the official rate notifications (Notification No. 9/2025-Central Tax (Rate) for CGST and 9/2025-Integrated Tax (Rate) for IGST) for the rate itself.',
    },
    {
      q: 'What happened to the old 12% and 28% slabs?',
      a: 'They were abolished by the 56th GST Council with effect from 22 September 2025: those goods moved to 5% or 18%. The 28% rate that still applied to cigarettes and tobacco was replaced by the 40% de-merit rate from 1 February 2026, when compensation cess on those goods was also withdrawn.',
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
