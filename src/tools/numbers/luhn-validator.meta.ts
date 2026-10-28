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
    { title: 'Compute a check digit', options: { mode: 'check-digit' } },
  ],
  faq: [
    {
      q: 'What is Luhn?',
      a: 'The mod-10 algorithm used as a quick validity check for numbers that include a check digit, such as credit cards and IMEIs.',
    },
    {
      q: 'Does Luhn guarantee a real card?',
      a: 'No — passing Luhn only verifies the number is well-formed; it gives no signal about issuer, funds, or account status.',
    },
    {
      q: 'How is the check digit computed?',
      a: 'Process digits from the right, doubling every second one and subtracting 9 from results over 9, then choose the digit that makes the sum a multiple of 10.',
    },
  ],
  related: [  "checksum-validator",
  "random-string"],
  status: 'stable',
};
