import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'whitespace-visualizer',
  name: 'Whitespace Visualizer',
  category: 'text',
  summary:
    'Reveal spaces, tabs, line endings, non-breaking spaces and zero-width formatting characters.',
  description:
    'Make invisible whitespace and formatting characters visible with Unicode labels, or clean text by converting non-breaking spaces to ordinary spaces and removing selected zero-width formatting characters. Zero-width joiners are preserved so emoji and joined scripts keep their shaping. All processing happens on your device.',
  keywords: [
    'whitespace visualizer',
    'invisible characters',
    'show tabs',
    'show spaces',
    'zero-width space',
    'non-breaking space',
    'NBSP',
    'line ending viewer',
    'clean invisible characters',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'visualize',
      choices: [
        { value: 'visualize', label: 'Visualize invisible characters' },
        { value: 'clean', label: 'Clean NBSP and zero-width formatting' },
      ],
    },
  ],
  examples: [
    { title: 'Tabs and spaces', input: 'name:\tAda Lovelace\n  role: analyst' },
    { title: 'Non-breaking space', input: 'price: 10 USD' },
    { title: 'Zero-width space', input: 'invisible​break' },
  ],
  faq: [
    {
      q: 'Which characters are shown in visualization mode?',
      a: 'Spaces, tabs, common Unicode spaces, line endings, C0/C1 control characters, byte-order marks, and selected zero-width formatting characters are replaced with labels containing their Unicode code point.',
    },
    {
      q: 'What does clean mode change?',
      a: 'It converts non-breaking spaces to ordinary spaces and removes zero-width space, non-joiner, word joiner, byte-order mark, and several invisible formatting controls. Zero-width joiner is retained because it is needed for emoji sequences and shaping in some scripts.',
    },
    {
      q: 'Are my text or files uploaded?',
      a: 'No. The text is processed entirely in your browser and is not sent over the network.',
    },
  ],
  article: [
    {
      heading: 'What the Whitespace Visualizer shows',
      body: 'Paste text and every invisible formatting character is replaced with a labelled marker, such as [SPACE U+0020], [TAB U+0009], [LF U+000A] or [NBSP U+00A0]. Common Unicode spaces, C0 and C1 control characters, byte-order marks and several zero-width formatting controls are all identified by name and code point.',
    },
    {
      heading: 'Finding the space that is not a space',
      body: 'This is the tool for the line that will not wrap or the string that refuses to equal itself: a non-breaking space, an en space or a zero-width space is invisible until you look. Pasting it here names the exact code point so you can find and replace it in the source.',
    },
    {
      heading: 'Clean mode for tricky characters',
      body: 'Switch to clean and the tool converts non-breaking spaces to ordinary spaces and removes the zero-width formatting characters that hide inside text. The zero-width joiner is deliberately kept, because stripping it breaks emoji sequences and joined scripts in some languages.',
    },
    {
      heading: 'How visualise and clean compare',
      body: 'Visualise labels each special character with its code point and keeps every byte; clean rewrites the text. So visualise is for diagnosis, while clean produces copy-paste-ready output you can paste back into your editor. Choose the mode for what you plan to do next.',
    },
    {
      heading: 'Nothing is sent anywhere',
      body: 'The text is processed entirely in your browser, with no upload and no network use. Whether you are inspecting invisible characters in confidential config or cleaning a file with hidden formatting, it stays on your device and works offline.',
    },
  ],
  related: ['unicode-lookup', 'remove-empty-lines', 'find-replace'],
  status: 'stable',
};
