import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'barcode-validator',
  name: 'UPC / EAN Barcode Validator',
  category: 'numbers',
  summary:
    'Validate GS1 GTIN barcodes — UPC-A, UPC-E, EAN-13 and EAN-8 — and compute their check digit.',
  description:
    'Paste a retail barcode number (UPC-A, UPC-E, EAN-13, EAN-8, or any GTIN up to 14 digits) and the tool verifies the GS1 check digit, identifies the format, and reports the manufacturer/company prefix country-group when it is a known GS1 code. A "check digit" mode computes the expected last digit for a partial code so you can build valid barcodes. Everything runs on-device with no uploads.',
  keywords: [
    'barcode validator',
    'UPC check digit',
    'EAN-13',
    'UPC-A',
    'UPC-E',
    'EAN-8',
    'GTIN validator',
    'GS1 check digit',
    'barcode verify',
    'retail barcode',
    'check digit calculator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'validate',
      choices: [
        { value: 'validate', label: 'Validate barcode' },
        { value: 'checkdigit', label: 'Compute check digit' },
      ],
    },
  ],
  examples: [
    { title: 'EAN-13', input: '4006381333931' },
    { title: 'UPC-A', input: '036000291452' },
    { title: 'Compute check digit', input: '400638133393', options: { mode: 'checkdigit' } },
  ],
  faq: [
    {
      q: 'What barcode formats do you accept?',
      a: 'UPC-A (12 digits), EAN-13 (13 digits), EAN-8 (8 digits), UPC-E (6 or 8 digits) and any GTIN up to 14 digits. Spaces and dashes between digits are ignored.',
    },
    {
      q: 'How is the check digit computed?',
      a: 'GS1 uses a weighted modulo-10 sum where digits alternate weights 3 and 1 (from the rightmost digit with weight 3). The check digit makes the weighted total a multiple of 10.',
    },
    {
      q: 'Is the manufacturer prefix authoritative?',
      a: 'The country-group (numeric system) is looked up from the GS1 prefix list built into the tool. The company-level prefix is reported as displayed but not resolved to a business name — that requires a licensed lookup.',
    },
    {
      q: 'Does this read barcode images?',
      a: 'No. This validates the numeric code itself. To generate barcodes, use the Barcode / QR generator instead.',
    },
  ],
  related: [  "barcode",
  "luhn-validator",
  "checksum-validator",
  "vin-validator"],
  status: 'stable',
};
