import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'css-units',
  name: 'CSS Unit Converter',
  category: 'web',
  summary: 'Convert between px, rem, em, pt, pc, in, cm, mm and % for CSS lengths.',
  description:
    'Enter a value like 24px, 1.5rem or 12pt and get the equivalent in px, rem, em, pt and % — using configurable root font size, parent font size and percent base. Follows the CSS absolute-length definitions (96 px per inch).',
  keywords: [
    'css units',
    'px to rem',
    'rem calculator',
    'pt to px',
    'css unit converter',
    'em to px',
    'root font size',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'fromUnit',
      label: 'Unit when input has none',
      type: 'select',
      default: 'px',
      choices: [
        { value: 'px', label: 'px' },
        { value: 'rem', label: 'rem' },
        { value: 'em', label: 'em' },
        { value: 'pt', label: 'pt' },
        { value: 'pc', label: 'pc' },
        { value: 'in', label: 'in' },
        { value: 'cm', label: 'cm' },
        { value: 'mm', label: 'mm' },
        { value: '%', label: '%' },
      ],
    },
    {
      key: 'toUnit',
      label: 'Highlight target unit',
      type: 'select',
      default: 'rem',
      choices: [
        { value: 'px', label: 'px' },
        { value: 'rem', label: 'rem' },
        { value: 'em', label: 'em' },
        { value: 'pt', label: 'pt' },
        { value: '%', label: '%' },
      ],
    },
    {
      key: 'rootFontSize',
      label: 'Root font size (px)',
      type: 'number',
      default: 16,
      min: 1,
      max: 128,
    },
    {
      key: 'parentFontSize',
      label: 'Parent font size (px)',
      type: 'number',
      default: 16,
      min: 1,
      max: 128,
    },
    {
      key: 'percentBase',
      label: 'Percent base (px)',
      type: 'number',
      default: 16,
      min: 1,
      max: 128,
    },
  ],
  examples: [
    { title: '24px', input: '24px' },
    { title: '1.5rem', input: '1.5rem' },
    { title: '12pt', input: '12pt' },
  ],
  faq: [
    {
      q: 'Why is em and % the same value here?',
      a: 'Both resolve against a font size — em against the parent font size and % against the percent base. With both left at 16 px they match; change either option to model a different context.',
    },
    {
      q: 'What does the highlighted target unit do?',
      a: 'It only decides which conversion is surfaced in the summary line, so the value you care about is easy to spot. The table always lists px, rem, em, pt and % together, so you never need to re-run the conversion to read a different unit.',
    },
    {
      q: 'Which units can I type?',
      a: 'Any of px, rem, em, pt, pc, in, cm, mm and %. If the number has no unit the Unit when input has none choice fills it in. Conversions use the CSS absolute-length definition of 96 pixels per inch, and em, rem and % follow the font sizes you set.',
    },
  ],
  article: [
    {
      heading: 'What the CSS unit converter returns',
      body: 'Enter a single length such as 24px, 1.5rem or 12pt and the tool returns a table with the equivalent in px, rem, em, pt and percent, using the CSS absolute-length definition of 96 pixels per inch. A summary line highlights whichever target unit you selected.',
    },
    {
      heading: 'Translating a design into rem',
      body: 'Use it when a design handoff arrives in points or pixels and your codebase works in rem: typing the value shows the rem equivalent at your root size at once, and switching the root font size option lets you see what happens at a different base without editing any CSS.',
    },
    {
      heading: 'The settings that change the answer',
      body: 'Root font size drives rem, parent font size drives em and the percent base drives %. The target unit choice only decides which row is echoed in the summary. Set the three sizes to your real page values, and the conversions match what the browser would compute for that context.',
    },
    {
      heading: 'Limits to keep in mind',
      body: 'Input is one number with an optional unit, so compound expressions like calc() are not evaluated. Viewport units such as vw and vh are not supported, since they depend on a live viewport rather than a font size. Results are rounded to four decimal places, which is plenty for layout values.',
    },
    {
      heading: 'Conversion without a round trip',
      body: 'The arithmetic runs in the page and no network request is made, so the tool works offline. Nothing you type is transmitted, and repeated conversions of a whole spacing scale stay on your device.',
    },
  ],
  related: ['aspect-ratio', 'gradient-css'],
  status: 'stable',
};
