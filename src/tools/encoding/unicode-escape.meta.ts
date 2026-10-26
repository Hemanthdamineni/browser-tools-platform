import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'unicode-escape',
  name: 'Unicode Escape / Unescape',
  category: 'encoding',
  summary: 'Convert text to and from \\uXXXX, \\xXX, \\u{...}, HTML and CSS escape forms.',
  description:
    'Turn non-ASCII (or all) characters into escape sequences for source code, or expand escapes back into readable text. Supports JavaScript, Python/JSON, HTML numeric and CSS notations.',
  keywords: ['unicode escape', 'u+', '\\u', 'codepoint', 'unescape', 'json string escape', 'ascii'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'escape',
      choices: [
        { value: 'escape', label: 'Text → Escapes' },
        { value: 'unescape', label: 'Escapes → Text' },
      ],
    },
    {
      key: 'style',
      label: 'Escape style',
      type: 'select',
      default: 'js',
      choices: [
        { value: 'js', label: 'JavaScript / JSON (\\uXXXX, \\u{...})' },
        { value: 'python', label: 'Python (\\uXXXX / \\U00XXXXXX)' },
        { value: 'css', label: 'CSS (\\XXXXXX )' },
        { value: 'html', label: 'HTML numeric (&#xXXXX;)' },
        { value: 'unicode-plus', label: 'U+XXXX' },
      ],
      showWhen: { key: 'mode', value: 'escape' },
    },
    {
      key: 'which',
      label: 'Which characters',
      type: 'select',
      default: 'non-ascii',
      choices: [
        { value: 'non-ascii', label: 'Only non-ASCII' },
        { value: 'all', label: 'All characters' },
      ],
      showWhen: { key: 'mode', value: 'escape' },
    },
  ],
  examples: [
    { title: 'Escape emoji', input: 'A → 😀', options: { mode: 'escape' } },
    { title: 'Unescape', input: 'caf\\u00e9 \\u{1f600}', options: { mode: 'unescape' } },
  ],
  related: ['html-entities', 'hex', 'string-escape', 'base64'],
  hidden: true,
  redirectTo: 'string-escape',
  status: 'stable',
};
