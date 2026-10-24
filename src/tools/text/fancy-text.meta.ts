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
  faq: [
    {
      q: 'Are these styles real fonts?',
      a: 'No. Each style is a set of separate Unicode code points that happen to look like bold, italic or script letters. They are not actual fonts, so how they render depends on the fonts installed on the device that displays them.',
    },
    {
      q: 'Is it accessible to screen readers?',
      a: 'Usually not. Screen readers often read these characters letter-by-letter or not at all, and the styled text may be announced as nonsense. Treat these styles as decoration for social posts, bios and headings — not for body text or anything that must be read aloud.',
    },
    {
      q: 'What happens to characters that have no styled form?',
      a: 'They are left exactly as they are. Every style covers A–Z and a–z, and most also cover 0–9; punctuation, spaces and emoji generally have no equivalent, so they pass through unchanged.',
    },
    {
      q: 'Does the output copy and paste correctly?',
      a: 'Yes. The result is a normal Unicode string, so it copies and pastes anywhere that accepts Unicode — social media, chat apps, documents. It will not look the same everywhere, because not every platform ships the glyphs.',
    },
    {
      q: 'What do the decorations do?',
      a: 'They append a Unicode combining mark to every character: a low line (underline), an overline, or a long stroke overlay (strikethrough). Combining marks can render inconsistently on some systems, so check the preview before posting.',
    },
  ],
  related: ['unicode-styles', 'unicode-normalize', 'case-convert', 'text-to-slug'],
  article: [
    {
      heading: 'What it does',
      body: 'Fancy Text Generator restyles plain text with Unicode code point tables. Each selected style — bold, italic, script, fraktur, double-struck, monospace, circled, squared, small caps, inverted or full-width — maps every A–Z, a–z and 0–9 letter to a dedicated code point, so the result is still normal text with special glyphs instead of regular letters. A decoration option can append a combining underline, overline or strikethrough.',
    },
    {
      heading: 'When to use it',
      body: 'Use it to make a headline, username or social post stand out where you cannot pick a real font — for example in a bio, a chat message or a form that only accepts plain text. It copies and pastes anywhere that accepts Unicode — handy for tweets, Discord names and Instagram captions without uploading an image.',
    },
    {
      heading: 'Input and output',
      body: 'Paste or type any text, choose a style and, if you like, a decoration, and the workbench shows the transformed copy-ready string. Characters a style cannot map — punctuation, spaces and most emoji — pass through unchanged, so "Plan B at 7pm" keeps its structure while its letters and digits are restyled.',
    },
    {
      heading: 'Limitations',
      body: 'These are glyph substitutions, not fonts, so the appearance depends on the fonts on the reader\u2019s device. Some styles only cover uppercase letters, and combining decorations can render inconsistently across platforms. A missing glyph may fall back to an unrelated font.',
    },
    {
      heading: 'Privacy',
      body: 'All styling happens locally in your browser. The text you type is never sent over the network and no account or upload is involved, so sensitive drafts never leave your device.',
    },
  ],
  status: 'stable',
};