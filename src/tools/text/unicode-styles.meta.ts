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
  article: [
    {
      heading: 'Plain text in, styled code points out',
      body: 'The converter walks the input one character at a time and swaps each supported letter or digit for a visually similar Unicode code point, leaving everything else exactly as it was. Full-width maps the printable ASCII range into the FF01–FF5E block and turns a normal space into an ideographic space. Circled covers A–Z, a–z and 0–9, squared covers capitals only, and math sans-serif bold covers A–Z, a–z and digits. The stats line tells you how many characters changed out of the total.',
    },
    {
      heading: 'Reversing styled text back to ASCII',
      body: 'Choose “Styled → plain text” with the matching style to run the same map backwards — the practical fix when a display name, caption or identifier arrives in full-width or circled form and you need the plain letters for a search box, a form or a filename.',
    },
    {
      heading: 'What happens to unsupported characters',
      body: 'Emoji, punctuation, accented letters and CJK are absent from every map, so they pass through untouched in both directions. The flip side is that squared-style lowercase letters have no equivalent and stay plain rather than being approximated or raising an error.',
    },
    {
      heading: 'Where styled text backfires',
      body: 'Styles are distinct code points, so they defeat search, sorting and database collation, and some platforms strip or mangle them. Treat the output as decoration for display only, never as a key. The conversion loop runs in this tab and the text is never uploaded anywhere.',
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
  related: ['case-convert', 'unicode-normalize', 'slugify', 'whitespace-visualizer'],
  status: 'stable',
};
