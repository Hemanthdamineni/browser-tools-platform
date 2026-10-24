import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'unicode-lookup',
  name: 'Unicode Code Point Explorer',
  category: 'text',
  summary: 'Inspect every character code point, plane, and UTF-8/UTF-16 encodings in a table.',
  description:
    'Paste any text and get a per-character breakdown: Unicode code point (U+XXXX), decimal value, Unicode plane, and the exact UTF-8 and UTF-16 byte sequences. Ideal for debugging mojibake, understanding astral characters such as emoji, or checking how a character is actually encoded.',
  keywords: [
    'unicode',
    'code point',
    'UTF-8',
    'UTF-16',
    'emoji codepoint',
    'byte sequence',
    'mojibake',
    'character encoding',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      choices: [
        { value: 'table', label: 'Table' },
        { value: 'lines', label: 'Lines' },
      ],
      default: 'table',
    },
    {
      key: 'maxChars',
      label: 'Max characters',
      type: 'number',
      default: 500,
    },
  ],
  examples: [
    {
      title: 'Inspect a mixed string',
      input: 'A e',
    },
    {
      title: 'Decode an emoji as UTF-16',
      input: '👍',
      options: { format: 'lines' },
    },
    {
      title: 'Look up a control character',
      input: '\t',
      options: { maxChars: 5 },
    },
  ],
  faq: [
    {
      q: 'What is a code point?',
      a: 'Each character in Unicode has a numeric code point, usually written U+ followed by hex, e.g. U+1F44D for the thumbs-up emoji.',
    },
    {
      q: 'Which characters count as astral?',
      a: 'Code points above U+FFFF live outside the Basic Multilingual Plane and are encoded in UTF-16 as a surrogate pair of two 16-bit units.',
    },
    {
      q: 'Why does the UTF-8 column matter?',
      a: 'Mojibake happens when bytes encoded in one UTF flavour are decoded as another. The UTF-8 column shows exactly how many bytes each character requires (1-4).',
    },
  ],
  article: [
    {
      heading: 'What the Unicode Code Point Explorer shows',
      body: 'It splits your text into characters and, for each one, reports the code point as U plus hex, its decimal value, the Unicode plane it lives in, and the exact UTF-8 and UTF-16 byte sequences. A table layout is the default; the lines format prints the same data as one compact record per character.',
    },
    {
      heading: 'When to reach for the code point view',
      body: 'Use it when a string comes back as garbage after a round trip through a database or an old file, when an emoji behaves oddly in code, or when you need to prove which bytes a character really occupies. Control characters are drawn with visible stand-ins so no row comes out blank.',
    },
    {
      heading: 'Caps and flags to watch for',
      body: 'Max characters caps the rows shown at 500 by default and 5,000 at most, and input beyond 100,000 characters is refused outright. Code points above U plus FFFF are labelled astral and flagged as using a UTF-16 surrogate pair, and the tool warns if the text contains Unicode noncharacters that are not safe for interchange.',
    },
    {
      heading: 'Inspection that stays local',
      body: 'The whole breakdown happens in your browser; the string you paste is never uploaded, and the page works offline.',
    },
  ],
  related: ['char-frequency', 'text-stats', 'case-convert'],
  status: 'stable',
};
