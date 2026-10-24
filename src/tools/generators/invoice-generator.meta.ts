import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'invoice-generator',
  name: 'Invoice Generator',
  category: 'generators',
  summary:
    'Build a clean, printable PDF invoice with line items, tax and totals, and save drafts locally.',
  description:
    'Fill in the sender and recipient, add line items with quantity, unit price and tax rate, and download a tidy A4 PDF invoice. Totals are computed in integer cents so they never drift, and your draft is kept in your browser only.',
  keywords: [
    'invoice',
    'invoice generator',
    'billing',
    'receipt',
    'quote',
    'pdf',
    'line items',
    'tax',
    'vat',
    'subtotal',
    'grand total',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'invoice-generator',
  options: [
    {
      // Filled in by the panel with the JSON invoice draft. The option keeps
      // the tool runnable from a test or the generic workbench with a manual
      // payload; the panel always drives it.
      key: 'model',
      label: 'Invoice draft (JSON)',
      type: 'textarea',
      default: '',
    },
    {
      key: 'outputName',
      label: 'Output file name',
      type: 'text',
      default: '',
      placeholder: 'Defaults to the invoice number',
    },
  ],
  examples: [
    {
      title: 'One service with tax',
      options: {
        model: JSON.stringify({
          version: 1,
          from: {
            name: 'Northwind Studio',
            line1: '12 Harbour Lane',
            line2: '',
            city: 'Portland',
            postal: 'OR 97205',
            country: 'USA',
            email: 'billing@northwind.example',
            phone: '',
          },
          to: {
            name: 'Acme Corp',
            line1: '9 Innovation Drive',
            line2: 'Suite 300',
            city: 'Austin',
            postal: 'TX 78701',
            country: 'USA',
            email: 'ap@acme.example',
            phone: '',
          },
          invoiceNumber: 'INV-1042',
          issueDate: '2026-10-01',
          dueDate: '2026-10-31',
          currency: 'USD',
          lines: [
            { description: 'Brand identity design', quantity: 1, unitPrice: 1250, taxRate: 8 },
            { description: 'Monthly hosting', quantity: 12, unitPrice: 24.5, taxRate: 8 },
          ],
          discountPercent: 0,
          notes: 'Thank you for your business!',
          terms: 'Payment due within 30 days.',
          logoDataUrl: '',
        }),
        outputName: 'INV-1042.pdf',
      },
    },
    {
      title: 'Discount applied',
      options: {
        model: JSON.stringify({
          version: 1,
          from: {
            name: 'Fern & Co',
            line1: '88 Willow Road',
            line2: '',
            city: 'London',
            postal: 'EC1V 3AR',
            country: 'UK',
            email: 'hello@fern.example',
            phone: '',
          },
          to: {
            name: 'Bright Byte Ltd',
            line1: '2 Tester Close',
            line2: '',
            city: 'Manchester',
            postal: 'M1 4BT',
            country: 'UK',
            email: 'accounts@brightbyte.example',
            phone: '',
          },
          invoiceNumber: 'INV-0018',
          issueDate: '2026-09-15',
          dueDate: '2026-10-15',
          currency: 'GBP',
          lines: [{ description: 'Onboarding workshop (10 seats)', quantity: 10, unitPrice: 45, taxRate: 20 }],
          discountPercent: 10,
          notes: '',
          terms: 'Payment due within 30 days.',
          logoDataUrl: '',
        }),
        outputName: 'INV-0018.pdf',
      },
    },
    {
      title: 'Simple no-tax invoice',
      options: {
        model: JSON.stringify({
          version: 1,
          from: {
            name: 'Jamie Rivera',
            line1: '4 Oak Street',
            line2: '',
            city: 'Denver',
            postal: 'CO 80202',
            country: 'USA',
            email: 'jamie@example.com',
            phone: '',
          },
          to: {
            name: 'Corner Bakery',
            line1: '77 Main Street',
            line2: '',
            city: 'Boulder',
            postal: 'CO 80301',
            country: 'USA',
            email: 'orders@cornerbakery.example',
            phone: '',
          },
          invoiceNumber: 'INV-0003',
          issueDate: '2026-08-01',
          dueDate: '',
          currency: 'USD',
          lines: [{ description: 'Logo refresh', quantity: 1, unitPrice: 350, taxRate: 0 }],
          discountPercent: 0,
          notes: '',
          terms: 'Payable on receipt.',
          logoDataUrl: '',
        }),
        outputName: 'INV-0003.pdf',
      },
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
  related: ['vcard', 'lorem-ipsum', 'nanoid'],
  credits: [{ name: 'pdf-lib', url: 'https://github.com/Hopding/pdf-lib', license: 'MIT' }],
  status: 'stable',
};