import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'rot13',
  name: 'ROT13 / Caesar Cipher',
  category: 'text',
  summary: 'Apply ROT13, ROT5, ROT18, ROT47 or an arbitrary Caesar shift to text.',
  description:
    'A family of simple substitution ciphers. ROT13 rotates letters, ROT5 rotates digits, ROT18 does both, ROT47 rotates printable ASCII, and Caesar shifts letters by any amount from 1 to 25.',
  keywords: [
    'rot13',
    'rot5',
    'rot18',
    'rot47',
    'caesar cipher',
    'caesar shift',
    'substitution cipher',
    'letter rotation',
    'encode',
    'decode',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'variant',
      label: 'Variant',
      type: 'select',
      default: 'rot13',
      choices: [
        { value: 'rot13', label: 'ROT13 (letters)' },
        { value: 'rot5', label: 'ROT5 (digits)' },
        { value: 'rot18', label: 'ROT18 (letters + digits)' },
        { value: 'rot47', label: 'ROT47 (printable ASCII)' },
        { value: 'caesar', label: 'Caesar (custom shift)' },
      ],
    },
    {
      key: 'shift',
      label: 'Caesar shift (1–25)',
      type: 'number',
      default: 3,
      min: 1,
      max: 25,
      step: 1,
      showWhen: { key: 'variant', value: 'caesar' },
    },
  ],
  examples: [
    { title: 'ROT13 "Hello"', input: 'Hello', options: { variant: 'rot13' } },
    { title: 'ROT47 "Hello"', input: 'Hello', options: { variant: 'rot47' } },
    { title: 'Caesar +3 on "abc XYZ"', input: 'abc XYZ', options: { variant: 'caesar', shift: 3 } },
  ],
  related: ['case-convert', 'reverse-text', 'morse-code', 'nato-phonetic'],
  status: 'stable',
};
