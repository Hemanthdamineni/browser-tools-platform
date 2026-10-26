import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-repeat',
  name: 'Repeat Text',
  category: 'text',
  summary:
    'Repeat the input a set number of times, joined by a newline, space, comma, or custom separator.',
  description:
    'Duplicate a string as many times as you like and join the copies with the separator of your choice. The result is capped at five million characters.',
  keywords: [
    'repeat text',
    'duplicate text',
    'repeat string',
    'multiply text',
    'text repeater',
    'loop text',
    'copy text n times',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'count',
      label: 'Number of copies',
      type: 'number',
      default: 10,
      min: 1,
      max: 100000,
      step: 1,
    },
    {
      key: 'separator',
      label: 'Separator between copies',
      type: 'select',
      default: 'newline',
      choices: [
        { value: 'newline', label: 'Newline' },
        { value: 'space', label: 'Space' },
        { value: 'comma', label: 'Comma' },
        { value: 'none', label: 'None (join directly)' },
        { value: 'custom', label: 'Custom…' },
      ],
    },
    {
      key: 'custom',
      label: 'Custom separator',
      type: 'text',
      default: '',
      placeholder: 'e.g. " | "',
      showWhen: { key: 'separator', value: 'custom' },
    },
  ],
  examples: [
    { title: 'Repeat "ab" 3× directly', input: 'ab', options: { count: 3, separator: 'none' } },
    { title: 'Comma-separated', input: 'x', options: { count: 5, separator: 'comma' } },
    {
      title: 'Custom separator',
      input: 'na',
      options: { count: 8, separator: 'custom', custom: ' ' },
    },
  ],
  related: ['reverse-text', 'case-convert', 'sort-lines', 'dedupe-lines'],
  status: 'stable',
};
