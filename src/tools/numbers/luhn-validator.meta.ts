import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'luhn-validator',
  name: 'Luhn Checksum Validator',
  category: 'numbers',
  summary: 'Validate and generate Luhn (mod-10) checksum numbers.',
  description:
    'Validate numbers that use the Luhn mod-10 algorithm (credit cards, IMEIs, some national ID and account numbers), generate a valid Luhn check digit for a number, and compute the expected check digit. Ignores non-digit separators such as spaces and dashes, and reports the card-network length prefixes when they look familiar.',
  keywords: [
    'Luhn',
    'mod-10',
    'checksum',
    'credit card validation',
    'IMEI',
    'check digit',
    'Luhn verify',
    'generate Luhn',
    'card number',
    'verhoeff',
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
        { value: 'validate', label: 'Validate number' },
        { value: 'check-digit', label: 'Compute check digit' },
        { value: 'generate', label: 'Generate with check digit' },
      ],
    },
  ],
  examples: [
    { title: 'Validate a card number', input: '4539 1488 0343 6467' },
    {
      title: 'Compute a check digit',
      input: '4539 1488 0343 646',
      options: { mode: 'check-digit' },
    },
    { title: 'Validate an IMEI', input: '490154203237518' },
    {
      title: 'Append a check digit to a prefix',
      input: '7992739871',
      options: { mode: 'generate' },
    },
  ],
  related: ['checksum-validator', 'random-string'],
  status: 'stable',
};
