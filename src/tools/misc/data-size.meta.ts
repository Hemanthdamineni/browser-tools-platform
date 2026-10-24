import type { ToolMeta } from '@/lib/types';

const unitChoices = [
  'B',
  'KB',
  'MB',
  'GB',
  'TB',
  'PB',
  'KiB',
  'MiB',
  'GiB',
  'TiB',
  'PiB',
  'bit',
  'Kbit',
  'Mbit',
  'Gbit',
];

export const meta: ToolMeta = {
  id: 'data-size',
  name: 'Data Size Converter',
  category: 'misc',
  summary: 'Convert data sizes between bytes, decimal/binary units and bits.',
  description:
    'Convert a data-size value between bytes, decimal units (KB through PB), binary units (KiB through PiB) and bits. The result includes a reference table of common units.',
  keywords: [
    'data size',
    'bytes',
    'kilobytes',
    'mebibytes',
    'bits',
    'binary units',
    'decimal units',
    'storage',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'from',
      label: 'Convert from',
      type: 'select',
      default: 'MB',
      choices: unitChoices.map((value) => ({ value, label: value })),
    },
    {
      key: 'to',
      label: 'Convert to',
      type: 'select',
      default: 'MiB',
      choices: unitChoices.map((value) => ({ value, label: value })),
    },
  ],
  article: [
    {
      heading: 'What the converter returns',
      body: 'Enter a number and choose the unit to convert from and the unit to convert to. The value becomes bytes internally and then the target unit; the table shows that result first, then the same quantity in B, KB, MB, GB, KiB, MiB, GiB and bits. Commas in the input are ignored, so 1,000 is read as 1000.',
    },
    {
      heading: 'Decimal units are not binary units',
      body: 'KB here means 1000 bytes and KiB means 1024, so one GB comes out as 953.674 MiB rather than 1024. Drive makers quote decimal units while operating systems report binary ones, which is why a drive sold as 1 TB shows up in a file manager as roughly 931 GiB.',
    },
    {
      heading: 'When a number does not add up',
      body: 'Reach for it when the same capacity is quoted two ways: checking whether a 4.7 GB DVD image fits a 4.38 GiB cloud volume, sizing a partition from a provider that bills in TiB, or turning a 100 Mbit link into the 12.5 MB/s a download manager shows.',
    },
    {
      heading: 'One number at a time, sixteen digits deep',
      body: 'The input must be a single finite number. Text such as 1.5 GB is rejected because the unit belongs in the dropdowns, and the result is rounded to sixteen significant digits, enough for any real storage figure without floating-point noise.',
    },
    {
      heading: 'Arithmetic that never leaves the tab',
      body: 'The conversion is plain multiplication and division in this page. No value, unit or file name is transmitted, the tool makes no network request, and it keeps working with your connection switched off.',
    },
  ],
  examples: [
    { title: 'One gigabyte in mebibytes', input: '1', options: { from: 'GB', to: 'MiB' } },
    { title: 'A mebibyte in plain bytes', input: '1', options: { from: 'MiB', to: 'B' } },
    { title: 'Megabits to megabytes', input: '100', options: { from: 'Mbit', to: 'MB' } },
  ],
  faq: [
    {
      q: 'Why does a 1 TB drive show less free space?',
      a: 'Drive makers use decimal units, where 1 TB is 1,000,000,000,000 bytes, while most operating systems report binary ones. Converted, 1 TB is about 0.909 TiB, or roughly 931 GiB — the same capacity counted differently.',
    },
    {
      q: 'Can I type "1.5 GB" into the input box?',
      a: 'No. The box takes the number only and the unit comes from the Convert from dropdown. Enter 1.5 and choose GB, or 1500 and choose MB, to get the same result.',
    },
    {
      q: 'How do the bit units work?',
      a: 'A byte is eight bits, so bit, Kbit, Mbit and Gbit are converted by dividing by eight. 100 Mbit therefore equals 12.5 MB, the quickest way to turn a link speed into a download rate.',
    },
  ],
  related: ['unit-convert', 'css-units'],
  status: 'stable',
};
