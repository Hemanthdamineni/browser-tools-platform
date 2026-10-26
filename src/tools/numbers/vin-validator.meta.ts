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
    {
      title: 'Compute a missing check digit',
      input: '1HGCM82603A004352',
      options: { mode: 'generate' },
    },
  ],
  related: ['luhn-validator', 'checksum-validator'],
  status: 'stable',
};
