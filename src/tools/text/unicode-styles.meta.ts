import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'unicode-styles',
  name: 'Unicode Style Converter',
  category: 'text',
  summary:
    'Convert text between plain ASCII and full-width, circled, squared or bold math sans-serif Unicode styles.',
  description:
    'Restyle text with Unicode letter maps, or restore styled text back to plain ASCII. Convert to and from full-width characters (ａｂｃ), circled letters and digits (Ⓐⓑ①), squared capitals (🄰🄱), and bold mathematical sans-serif letters (𝗮𝗯𝗰). Characters without a styled form are left unchanged, and all processing stays in your browser.',
  keywords: [
    'unicode style converter',
    'full-width text',
    'fullwidth converter',
    'circled letters',
    'bubble text',
    'squared letters',
    'math sans-serif',
    'unicode font converter',
    'fancy text',
    'restore unicode text',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'conversion',
      label: 'Conversion',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Plain text → styled' },
        { value: 'decode', label: 'Styled → plain text' },
      ],
    },
    {
      key: 'style',
      label: 'Style',
      type: 'select',
      default: 'fullwidth',
      choices: [
        { value: 'fullwidth', label: 'Full-width (ａｂｃ)' },
        { value: 'circled', label: 'Circled (Ⓐⓑ①)' },
        { value: 'squared', label: 'Squared (🄰🄱)' },
        { value: 'monospace', label: 'Math sans-serif bold (𝗮𝗯𝗰)' },
      ],
    },
  ],
  examples: [
    { title: 'Full-width output', input: 'Meet at 10:30', options: { style: 'fullwidth' } },
    {
      title: 'Restore full-width text',
      input: 'Ｈｅｌｌｏ，ｗｏｒｌｄ！',
      options: { conversion: 'decode', style: 'fullwidth' },
    },
    {
      title: 'Circled letters',
      input: 'Plan B',
      options: { style: 'circled' },
    },
    {
      title: 'Math sans-serif bold',
      input: 'E = mc2',
      options: { style: 'monospace' },
    },
  ],
  faq: [
    {
      q: 'Can I convert styled text back to ASCII?',
      a: 'Yes. Choose "Styled → plain text" with the matching style. Every code point this tool can produce maps back to exactly one plain character; anything else passes through unchanged.',
    },
    {
      q: 'What happens to unsupported characters?',
      a: 'They are left exactly as they are. For example, emoji and punctuation in the squared style have no equivalent, so they stay unchanged while letters are restyled.',
    },
    {
      q: 'Which characters does each style cover?',
      a: 'Full-width covers the whole printable ASCII range and turns spaces into ideographic spaces. Circled covers A–Z, a–z and 0–9. Squared covers A–Z. Math sans-serif covers A–Z, a–z and 0–9.',
    },
  ],
  related: ['case-convert', 'unicode-escape', 'slugify', 'whitespace-visualizer'],
  status: 'stable',
};
