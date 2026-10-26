import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'fancy-text',
  name: 'Fancy Text Generator',
  category: 'text',
  summary:
    'Restyle text into bold, italic, script, fraktur, double-struck, circled, squared and more Unicode letter styles.',
  description:
    'Turn plain text into decorative Unicode letter styles — bold, italic, script, fraktur, double-struck, monospace, circled, squared, small caps, inverted and full-width — and optionally underline, overline or strikethrough it. Each style maps A–Z, a–z and 0–9 through a Unicode code point table, so characters without a styled form are left exactly as they are. Everything is processed locally in your browser and the result copies straight out of the workbench.',
  keywords: [
    'fancy text',
    'unicode text',
    'bold text',
    'italic text',
    'script text',
    'fraktur text',
    'double-struck text',
    'monospace text',
    'circled letters',
    'squared letters',
    'small caps',
    'fullwidth text',
    'stylish text',
    'decorate text',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'style',
      label: 'Style',
      type: 'select',
      default: 'bold',
      choices: [
        { value: 'bold', label: 'Bold (𝗔𝗯𝟭)' },
        { value: 'italic', label: 'Italic (𝐴𝑏)' },
        { value: 'script', label: 'Script (𝒜𝓏)' },
        { value: 'fraktur', label: 'Fraktur (𝔄𝔤)' },
        { value: 'double-struck', label: 'Double-struck (𝔸𝕓𝟘)' },
        { value: 'monospace', label: 'Monospace (𝚃𝚎𝚡𝚝)' },
        { value: 'circled', label: 'Circled (Ⓐⓑ①)' },
        { value: 'squared', label: 'Squared (🄰)' },
        { value: 'small-caps', label: 'Small caps (ꜱᴍᴀʟʟ)' },
        { value: 'inverted', label: 'Inverted (🅰🅱)' },
        { value: 'fullwidth', label: 'Fullwidth (Ａｂ１)' },
      ],
    },
    {
      key: 'decorations',
      label: 'Decoration',
      type: 'select',
      default: 'none',
      choices: [
        { value: 'none', label: 'None' },
        { value: 'underline', label: 'Underline' },
        { value: 'overline', label: 'Overline' },
        { value: 'strikethrough', label: 'Strikethrough' },
      ],
    },
  ],
  examples: [
    { title: 'Bold', input: 'Hello World', options: { style: 'bold' } },
    { title: 'Fraktur', input: 'fancy text', options: { style: 'fraktur' } },
    { title: 'Circled digits', input: 'Plan B at 7pm', options: { style: 'circled' } },
    {
      title: 'Small caps headline',
      input: 'BREAKING NEWS',
      options: { style: 'small-caps' },
    },
    {
      title: 'Bold with underline',
      input: 'Important!',
      options: { style: 'bold', decorations: 'underline' },
    },
    {
      title: 'Fullwidth with strikethrough',
      input: 'draft v2',
      options: { style: 'fullwidth', decorations: 'strikethrough' },
    },
  ],
  related: ['unicode-styles', 'unicode-normalize', 'case-convert', 'text-to-slug'],
  status: 'stable',
};
