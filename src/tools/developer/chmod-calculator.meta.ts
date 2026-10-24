import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'chmod-calculator',
  name: 'chmod Permission Calculator',
  category: 'developer',
  summary:
    'Convert Unix file permissions between octal (755) and symbolic (rwxr-xr-x), with a per-class breakdown.',
  description:
    'Paste an octal mode such as 755, 0644 or 4755, or a symbolic string such as rwxr-xr-x or -rwsr-xr-x. The tool shows the 4-digit octal form, the 9-character symbolic form, and a table of read / write / execute plus setuid, setgid and sticky bits for owner, group and other.',
  keywords: [
    'chmod calculator',
    'chmod',
    'file permissions',
    'octal permissions',
    'symbolic permissions',
    'unix permissions',
    'setuid',
    'setgid',
    'sticky bit',
    'rwxr-xr-x',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect input' },
        { value: 'to-symbolic', label: 'Octal → symbolic' },
        { value: 'to-octal', label: 'Symbolic → octal' },
      ],
    },
  ],
  examples: [
    { title: '755 to symbolic', input: '755', options: { mode: 'auto' } },
    { title: 'Symbolic to octal', input: 'rwxr-xr-x', options: { mode: 'auto' } },
    { title: 'setuid binary (4755)', input: '4755', options: { mode: 'to-symbolic' } },
  ],
  article: [
    {
      heading: 'Two notations, one model',
      body: 'Paste either the octal mode (755, 0644, 4755) or the symbolic string (rwxr-xr-x, -rwsr-xr-x) and the tool builds the same internal model — read, write and execute for owner, group and other, plus the special bits — and shows both the 4-digit octal form and the 9-character symbolic form with a per-class table.',
    },
    {
      heading: 'When the special bits matter',
      body: 'The fourth octal digit carries setuid (4), setgid (2) and sticky (1). 4755 means setuid plus rwxr-xr-x. In the symbolic form a lower-case s is the special bit plus execute while an upper-case S is the special bit without it, and t/T do the same for sticky — the usual point of confusion, spelled out per class.',
    },
    {
      heading: 'Which input style to pick',
      body: 'Auto-detect reads either notation and picks the direction from the input, which is all most people need. Force a direction when there is doubt. A 10-character symbolic string with a leading file-type character such as d or - is accepted, and that first character is ignored.',
    },
    {
      heading: 'The stats give you the mode at a glance',
      body: 'The result reports the octal mode, the 3-digit octal form without the special digit, the symbolic string and the ls-style form with a leading dash, so you can copy exactly the token a command or a script expects.',
    },
    {
      heading: 'Nothing leaves the browser',
      body: 'Parsing and rendering are pure local logic in this tab. Even a permission string is never transmitted, and the tool is fully offline.',
    },
  ],
  faq: [
    {
      q: 'What does the fourth octal digit mean?',
      a: 'It is the special-bits digit: setuid = 4, setgid = 2, sticky = 1. 4755 means setuid plus rwxr-xr-x.',
    },
    {
      q: 'What is the difference between s and S in the symbolic form?',
      a: 'Lowercase s means the special bit and the execute bit are both set; uppercase S means the special bit is set but execute is not.',
    },
    {
      q: 'Does it accept a leading file-type character?',
      a: 'Yes. A 10-character symbolic string such as -rwxr-xr-x or drwxr-xr-x is accepted; the first character is ignored.',
    },
  ],
  related: ['number-base', 'hash-identifier', 'hex', 'base64'],
  status: 'stable',
};
