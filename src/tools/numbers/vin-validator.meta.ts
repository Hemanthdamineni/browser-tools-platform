import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'vin-validator',
  name: 'VIN Validator & Decoder',
  category: 'numbers',
  summary: 'Validate and decode 17-character VINs with check digit.',
  description:
    'Validate a 17-character Vehicle Identification Number using the ISO 3779/NHTSA weighted check-digit algorithm, then decode its structure: World Manufacturer Identifier (region and manufacturer), vehicle descriptor, model year, assembly plant, and serial. Flags illegal letters (I, O, Q), wrong length, and check-digit mismatches.',
  keywords: [
    'VIN',
    'vehicle identification number',
    'VIN decoder',
    'check digit',
    'ISO 3779',
    'WMI',
    'model year',
    'chassis number',
    'car history',
    'NHTSA',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'decode',
      choices: [
        { value: 'decode', label: 'Decode and validate' },
        { value: 'validate', label: 'Checksum only' },
        { value: 'generate', label: 'Complete a VIN with check digit' },
      ],
    },
  ],
  examples: [
    { title: 'Decode a VIN', input: '1HGCM82633A004352' },
    { title: 'Validate only', options: { mode: 'validate' } },
  ],
  faq: [
    {
      q: 'What makes a VIN valid?',
      a: 'Exactly 17 characters from 0–9 and A–Z excluding I, O and Q, plus a check digit at position 9 that matches the weighted sum (mod 11).',
    },
    {
      q: 'Can the check digit be X?',
      a: 'Yes — the remainder 10 is written as the letter X, which is the only allowed letter in position 9.',
    },
    {
      q: 'Do all VINs use the check digit?',
      a: 'Vehicles built for the US market do. Some other markets historically use a serial number in position 9, so a checksum mismatch alone does not always mean a fake VIN.',
    },
  ],
  related: ['luhn-validator', 'checksum-validator'],
  status: 'stable',
};
