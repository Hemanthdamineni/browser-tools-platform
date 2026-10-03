import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'programmer-calculator',
  name: 'Programmer Calculator',
  category: 'misc',
  summary: 'Calculate integer expressions with bitwise operators in multiple bases.',
  description:
    'Evaluate integer expressions using BigInt, bitwise operators and decimal, hexadecimal, octal or binary literals. View the result in common bases, with its fixed-width two’s-complement value and set-bit count.',
  keywords: ['programmer calculator', 'bitwise', 'integer', 'hex', 'binary', 'octal', 'BigInt', 'bit operations'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'bits', label: 'Bit width', type: 'select', default: '32', choices: [{ value: '8', label: '8-bit' }, { value: '16', label: '16-bit' }, { value: '32', label: '32-bit' }, { value: '64', label: '64-bit' }] },
    { key: 'signed', label: 'Interpret as signed', type: 'boolean', default: false },
  ],
  examples: [{ title: 'Hexadecimal OR', input: '0xF0 | 0x0F' }, { title: 'Shift', input: '1 << 4' }, { title: 'Complement', input: '~0', options: { bits: '8' } }],
  related: ['number-base', 'calculator'],
  status: 'stable',
};
