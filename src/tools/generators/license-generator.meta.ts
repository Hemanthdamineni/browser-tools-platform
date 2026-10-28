import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'license-generator',
  name: 'License Generator',
  category: 'generators',
  summary:
    'Generate a full open-source license text (MIT, Apache-2.0, BSD, ISC, Unlicense, CC0) with your year and name filled in.',
  description:
    'Pick a license and get the complete text with {year} and {fullname} already substituted — MIT, ISC, BSD-2/3-Clause, Apache-2.0, Unlicense and CC0-1.0. Copy it straight into your LICENSE file. Use the year and full name fields, or paste a copyright line of your own. Everything runs on your device.',
  keywords: [
    'license generator',
    'open source license',
    'mit license',
    'apache 2.0 license',
    'bsd license text',
    'choose a license',
    'add license to project',
    'license text generator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'license',
      label: 'License',
      type: 'select',
      choices: [
        { value: 'MIT', label: 'MIT' },
        { value: 'Apache-2.0', label: 'Apache License 2.0' },
        { value: 'BSD-2-Clause', label: 'BSD 2-Clause' },
        { value: 'BSD-3-Clause', label: 'BSD 3-Clause' },
        { value: 'ISC', label: 'ISC' },
        { value: 'Unlicense', label: 'The Unlicense' },
        { value: 'CC0-1.0', label: 'CC0 1.0' },
      ],
      default: 'MIT',
    },
    {
      key: 'year',
      label: 'Copyright year',
      type: 'text',
      default: '<current year>',
    },
    {
      key: 'fullname',
      label: 'Copyright holder',
      type: 'text',
      default: '<your name>',
    },
  ],
  examples: [
    {
      title: 'Fill in the options and paste this',
      input: 'Your project description goes here',
    },
  ],
  faq: [
    {
      q: 'Which licenses are included?',
      a: 'MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense and CC0-1.0 — the most common open-source licenses. Each text is the canonical text with just the year and holder substituted.',
    },
    {
      q: 'How do I pick the right license?',
      a: 'For most libraries use MIT, Apache-2.0 or BSD-3. If you want to waive all rights use Unlicense or CC0-1.0. This tool only produces the text — check the license’s terms with your own legal counsel before choosing.',
    },
    {
      q: 'Is the output the full official text?',
      a: 'Yes — you can paste it directly into a LICENSE file. The texts are the standard license texts with the year and holder substituted; verify against the SPDX reference if you ship to a regulated environment.',
    },
  ],
  related: [  "nanoid",
  "uuid",
  "lorem-ipsum",
  "gitignore"],
  status: 'stable',
};
