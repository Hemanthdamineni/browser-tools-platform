import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'backslash-escape',
  name: 'Backslash Escape / Unescape',
  category: 'developer',
  summary:
    'Turn control characters into readable \\n \\t \\xNN \\uNNNN sequences, or interpret those sequences back into characters.',
  description:
    'Escape converts real control and non-printable characters into backslash sequences (\\n, \\t, \\r, \\f, \\v, \\0, \\\\, and \\xNN / \\uNNNN / \\u{…} for anything else). Unescape reverses them. An unknown escape such as \\q simply loses its backslash and is reported as a note.',
  keywords: [
    'backslash escape',
    'unescape',
    'control characters',
    'escape sequences',
    'newline to \\n',
    '\\xNN',
    '\\uNNNN',
    'non-printable characters',
    'whitespace escape',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'escape',
      choices: [
        { value: 'escape', label: 'Characters → escape sequences' },
        { value: 'unescape', label: 'Escape sequences → characters' },
      ],
    },
  ],
  examples: [
    { title: 'Escape a tab and newline', input: 'a\tb\nc', options: { mode: 'escape' } },
    {
      title: 'Unescape sequences',
      input: 'line1\\nline2\\tend',
      options: { mode: 'unescape' },
    },
    {
      title: 'Unescape a code point',
      input: '\\u{1F600} smile',
      options: { mode: 'unescape' },
    },
  ],
  faq: [
    {
      q: 'What happens to an unknown escape like \\q?',
      a: 'The backslash is dropped and the letter is kept ("q"). Every distinct unknown escape is listed in a note under the output.',
    },
    {
      q: 'Which characters get escaped?',
      a: 'Real control characters use their short form (\\n, \\t, \\r, \\f, \\v, \\0), backslash doubles, and every other Unicode "Other" character (control, format, surrogate, private-use) becomes \\xNN, \\uNNNN, or \\u{…}. Ordinary letters, punctuation and spaces pass through unchanged.',
    },
    {
      q: 'When does it raise an error?',
      a: 'Only when unescaping a \\u{…} sequence that is unterminated, is not hexadecimal, or names a code point above U+10FFFF.',
    },
  ],
  related: ['string-escape', 'unicode-escape', 'json-escape', 'hex'],
  hidden: true,
  redirectTo: 'string-escape',
  status: 'stable',
};
