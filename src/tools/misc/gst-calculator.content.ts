/**
 * Editorial content for the gst-calculator tool page.
 *
 * Kept out of ``gst-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
import { RATES_AS_OF, RATES_SOURCE } from './gst-calculator.meta';

export const content = {
  article: [
    {
      heading: 'Reading the result table',
      body: 'Paste a number into the text box or leave it empty and set the Amount field. The output lists the taxable value, the tax components and the gross amount in rupees, each rounded to the nearest paisa. Add mode treats the figure as the price before GST; Remove mode treats it as the inclusive total and divides by one plus the rate to recover the base.',
    },
    {
      heading: 'Rates and the CGST/SGST split',
      body: 'The picker carries the common notified slabs — 0.25, 1.5, 3, 5, 12, 18 and 28 percent — plus any custom rate from 0 to 100. An intra-state supply splits the rate evenly into CGST and SGST, so 18 percent becomes 9 plus 9. An inter-state supply charges the full rate as IGST instead.',
    },
    {
      heading: 'When to use it',
      body: 'Useful for a quick invoice check: enter an 11,800 inclusive total at 18 percent to confirm the taxable value is 10,000, or price a 50,000 inter-state sale at the 28 percent slab before quoting a customer.',
    },
    {
      heading: 'Caveats and privacy',
      body: 'This is arithmetic, not tax advice: it ignores input tax credit and compensation cess and does not decide which rate a product carries. Everything runs on your device in the browser, with no upload and nothing stored between visits.',
    },
  ],
  faq: [
    {
      q: 'Which GST rates are current, and where were they verified?',
      a: `Rates reflect the CBIC schedule checked on ${RATES_AS_OF} — source: ${RATES_SOURCE}. The picker also accepts any custom rate from 0 to 100. GST has separate schedules for goods and services, and the applicable rate depends on the HSN or SAC code, so confirm the rate for your item on the CBIC portal before invoicing.`,
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
      a: 'That depends on the HSN or SAC code and the schedule the item falls under, and this calculator deliberately does not guess. Use the rate picker for arithmetic, then confirm the rate on the CBIC GST portal.',
    },
  ],
} as const;
