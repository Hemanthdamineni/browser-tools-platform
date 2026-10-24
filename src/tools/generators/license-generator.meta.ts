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
  article: [
    {
      heading: 'What it produces',
      body: 'Pick a license and the tool returns the complete canonical text with the year and copyright holder substituted in: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense or CC0-1.0. The output also carries a matching copyright header, except Unlicense and CC0-1.0, which are headerless by design.',
    },
    {
      heading: 'A good moment to reach for it',
      body: 'Starting a repository and needing a LICENSE file you can commit: choose MIT, confirm the year and your name, copy the text, and paste it in without revisiting a license website. The reverse case is just as common — an existing project has no LICENSE file and you want the exact canonical wording rather than a paraphrase copied from a blog post.',
    },
    {
      heading: 'What the fields change',
      body: "license selects the text and its header style — Apache-2.0 uses a bare 'Copyright' line while the others use 'Copyright (c)' with the holder. Leaving year blank or at its <current year> placeholder emits the present year; leaving the name at <your name> leaves a visible placeholder in both header and body rather than inventing a holder.",
    },
    {
      heading: 'Caveats worth knowing',
      body: 'The substituted texts are exactly what the license bodies say — nothing is validated against SPDX, and the tool only assembles text, so it gives no legal advice. Unlicense and CC0-1.0 ignore the holder field entirely because their texts waive rights rather than name an owner.',
    },
    {
      heading: 'Privacy',
      body: 'Nothing leaves the browser: the template, the substitution and the copy button all run on your device. The year and holder you type are never transmitted, and there is no network request that could leak what you are about to license.',
    },
  ],
  examples: [
    {
      title: 'MIT with the default wording',
      options: { license: 'MIT' },
    },
    {
      title: 'MIT for a year and a person',
      options: { license: 'MIT', year: '2026', fullname: 'Ada Lovelace' },
    },
    {
      title: 'Headerless Unlicense',
      options: { license: 'Unlicense' },
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
  related: ['nanoid', 'uuid', 'lorem-ipsum', 'gitignore'],
  status: 'stable',
};
