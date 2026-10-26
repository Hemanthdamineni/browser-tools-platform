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
  related: ['barcode', 'luhn-validator', 'checksum-validator', 'vin-validator'],
  status: 'stable',
};
