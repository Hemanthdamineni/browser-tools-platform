import type { ToolMeta } from '@/lib/types';

const unitChoices = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'bit', 'Kbit', 'Mbit', 'Gbit'];

export const meta: ToolMeta = {
  id: 'data-size',
  name: 'Data Size Converter',
  category: 'misc',
  summary: 'Convert data sizes between bytes, decimal/binary units and bits.',
  description:
    'Convert a data-size value between bytes, decimal units (KB through PB), binary units (KiB through PiB) and bits. The result includes a reference table of common units.',
  keywords: ['data size', 'bytes', 'kilobytes', 'mebibytes', 'bits', 'binary units', 'decimal units', 'storage'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'from', label: 'Convert from', type: 'select', default: 'MB', choices: unitChoices.map((value) => ({ value, label: value })) },
    { key: 'to', label: 'Convert to', type: 'select', default: 'MiB', choices: unitChoices.map((value) => ({ value, label: value })) },
  ],
  examples: [{ title: 'One gigabyte in mebibytes', input: '1', options: { from: 'GB', to: 'MiB' } }],
  related: ['unit-convert', 'css-units'],
  status: 'stable',
};
