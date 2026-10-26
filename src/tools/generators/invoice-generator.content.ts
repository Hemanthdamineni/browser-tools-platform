/**
 * Editorial content for the invoice-generator tool page.
 *
 * Kept out of ``invoice-generator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the invoice generator does',
      body: 'The form collects the sender and recipient details, an invoice number, issue and due dates, and any number of line items — each with a description, a quantity, a unit price and its own tax rate. A discount can be applied to the whole subtotal, and you can attach a logo and add free-text notes and payment terms. As you type, the subtotal, total tax, discount and grand total update live, and Generate PDF writes a clean A4 invoice you can email or print.',
    },
    {
      heading: 'How the totals are worked out',
      body: 'Every figure is computed in integer cents, never in floating-point money, so the printed numbers never drift by a hundredth. Each line amount is the quantity times the unit price rounded to the nearest cent; each line tax is that amount times the line’s tax rate, again rounded to the nearest cent; the discount is the subtotal times the discount percentage rounded to the nearest cent. All rounding is half-up at two decimals.',
    },
    {
      heading: 'Drafts, formats and layout',
      body: 'The whole invoice can be saved as a draft in your browser and reloaded later; the Save, Load and Clear buttons control it. The PDF is A4 portrait, drawn with pdf-lib, with an optional PNG or JPEG logo at the top. Amounts are shown in the currency you pick from the list, and the output file is named after the invoice number unless you set a name yourself.',
    },
    {
      heading: 'Limits and privacy',
      body: 'The PDF fits on a single page, so very long line lists or long notes may run close to the bottom; keep items concise for the tidiest result. The currency setting is a label and does not convert between currencies, and no tax rules are applied automatically — you enter the rate for each line. Everything runs on your device: the form, the draft storage and the PDF are all local, with no request and no account.',
    },
  ],
  faq: [
    {
      q: 'How are totals rounded?',
      a: 'Everything is computed in integer cents to avoid float drift. Each line amount is quantity × unit price rounded to the nearest cent; each line tax is that amount × tax rate % rounded to the nearest cent; and the discount is the subtotal × discount % rounded to the nearest cent. All rounding is half-up at two decimals, so the printed numbers match hand arithmetic.',
    },
    {
      q: 'How is tax applied?',
      a: 'Tax is computed per line item using that line’s own tax rate, rounded to the nearest cent, then all line taxes are summed into the total tax. So a 5% and a 20% line on the same invoice each contribute their own tax figure.',
    },
    {
      q: 'Where is my draft saved?',
      a: 'Only in your browser’s localStorage. The Save draft button stores the current form, Load draft restores it, and Clear wipes it. Nothing is uploaded and the data is removed when you clear your site data.',
    },
    {
      q: 'Can I add a logo?',
      a: 'Yes — the optional logo field accepts a PNG or JPEG from your device. It is embedded into the PDF locally and never uploaded.',
    },
  ],
} as const;
