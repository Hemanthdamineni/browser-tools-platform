import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-escape',
  name: 'JSON String Escape / Unescape',
  category: 'data',
  summary: 'Turn raw text into a quoted JSON string literal, or decode a JSON string literal back.',
  description:
    'Escape mode wraps your text in double quotes and escapes quotes, backslashes, newlines and control characters so it is a valid JSON string literal. Unescape mode parses a JSON string literal back to the raw text.',
  keywords: [
    'json escape',
    'json unescape',
    'json string escape',
    'escape quotes',
    'json string literal',
    'stringify',
    'json encode string',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'escape',
      choices: [
        { value: 'escape', label: 'Escape (text → JSON string literal)' },
        { value: 'unescape', label: 'Unescape (JSON string literal → text)' },
      ],
    },
  ],
  examples: [
    {
      title: 'Escape a line with quotes',
      input: 'She said "hi"\nbye',
      options: { mode: 'escape' },
    },
    { title: 'Unescape a literal', input: '"line1\\nline2"', options: { mode: 'unescape' } },
    { title: 'Unescape without surrounding quotes', input: 'a\\tb', options: { mode: 'unescape' } },
  ],
  related: ['json-format', 'ndjson'],
  hidden: true,
  redirectTo: 'string-escape',
  status: 'stable',
};
