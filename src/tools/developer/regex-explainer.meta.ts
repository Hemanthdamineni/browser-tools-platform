import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'regex-explainer',
  name: 'Regex Explainer',
  category: 'developer',
  summary: 'Break a regular expression into tokens with a plain-English explanation of each piece.',
  description:
    'Paste a regular expression and get a token-by-token breakdown: each literal, character class, escape, group, quantifier and anchor is explained in plain English in a table. Capturing vs non-capturing vs lookaround groups are told apart, quantifiers say exactly how many repetitions they require (and whether they are lazy), and every flag is decoded. Works on your device, so nothing is sent anywhere.',
  keywords: [
    'regex explainer',
    'explain regular expression',
    'regex101 alternative',
    'readable regex',
    'regex token breakdown',
    'what does this regex do',
    'regex meaning',
    'regex cheat',
    'decode regex pattern',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'flags',
      label: 'Flags',
      type: 'text',
      default: '',
      placeholder: 'e.g. gi',
    },
  ],
  examples: [
    {
      title: 'Common pattern',
      input: '^[a-z0-9_-]{3,16}$',
      options: { flags: 'i' },
    },
    {
      title: 'Groups and quantifiers',
      input: `^(https?://)?(\\d{1,3}\\.){3}\\d{1,3}(:\\d{2,5})?(/[\\w./-]*)?$`,
    },
    {
      title: 'Lookaround and named group',
      input: '(?<user>\\w+)(?=@)\\s*@\\s*(?!spam\\.)[\\w.]+',
      options: { flags: 'gi' },
    },
  ],
  related: ['regex-tester', 'jsonpath', 'find-replace', 'markdown-link-checker'],
  status: 'stable',
};
