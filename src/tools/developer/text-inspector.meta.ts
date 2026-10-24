import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-inspector',
  name: 'Text Encoding & Character Inspector',
  category: 'developer',
  summary: 'Inspect BOMs, line endings, control characters, and Unicode code points in text.',
  description:
    'Analyze pasted text for common Unicode byte-order marks, newline styles, control and format characters, zero-width marks, and unusual code points. Findings include code point and line/column without changing the input. Text remains in your browser.',
  keywords: [
    'text encoding inspector',
    'unicode inspector',
    'character code point',
    'find invisible characters',
    'zero width character',
    'bom detector',
    'line ending detector',
    'control character finder',
    'unicode debug',
    'utf-8 bom',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'showAllNonAscii',
      label: 'Include every non-ASCII character',
      type: 'boolean',
      default: false,
    },
    {
      key: 'maxFindings',
      label: 'Maximum character findings',
      type: 'number',
      default: 500,
      min: 10,
      max: 5000,
    },
  ],
  article: [
    {
      heading: 'What it reports',
      body: 'Pasted text comes back as two sections: a summary counting code points, non-ASCII code points, the leading BOM, and line endings split into CRLF, LF and CR, plus a findings table with line, column, hex code point, category, name and the character itself. Flagged categories are control characters, format and invisible characters, unusual spaces, and combining marks.',
    },
    {
      heading: 'When to use it',
      body: 'Paste a snippet that misbehaves — invisible characters carried in from a web page, or line endings that wreck a diff — and the table names the exact line and column of each suspect code point so you can delete or escape just those.',
    },
    {
      heading: 'Options that change the result',
      body: "showAllNonAscii widens reporting to every code point above U+007F instead of only the flagged categories, which is what you want when checking whether a string is pure ASCII. maxFindings caps the table at 10 to 5000 rows; the summary's reported-finding count stays truthful and the notes state how many rows were dropped.",
    },
    {
      heading: 'Edge cases worth knowing',
      body: 'The input is already a JavaScript string, so the original byte encoding is gone before the tool runs — it sees a leading BOM character but cannot tell UTF-8 from UTF-16. The BOM is deliberately kept out of the findings table and shown only in the summary, and carriage returns are counted apart from CRLF pairs.',
    },
    {
      heading: 'Privacy',
      body: 'All scanning happens on your device against the string you paste. Nothing is uploaded and no options are sent anywhere.',
    },
  ],
  examples: [
    { title: 'Find zero-width and non-breaking spaces', input: 'one\u00a0two\u200bthree' },
    { title: 'Inspect mixed line endings', input: 'first\r\nsecond\nthird\rfour' },
    { title: 'Inspect a BOM and emoji', input: '\ufeffHello 👋' },
  ],
  faq: [
    {
      q: 'Does this detect the original file encoding?',
      a: 'No. The tool receives a JavaScript string after the browser has already decoded its source. It can identify a leading Unicode BOM character and inspect code points, but it cannot reliably recover the original byte encoding from pasted text.',
    },
    {
      q: 'Why are some characters marked as format characters?',
      a: 'Unicode format characters can affect text direction, joining, or display while remaining invisible, such as zero-width joiners and bidirectional controls. Some are legitimate in language text; inspect context before removing them.',
    },
    {
      q: 'Does this modify or upload my text?',
      a: 'No. It reports character and newline findings without changing the input or sending network requests.',
    },
  ],
  related: ['unicode-normalize', 'unicode-lookup', 'line-numbers'],
  status: 'stable',
};
