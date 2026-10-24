import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'password-strength',
  name: 'Password Strength Analyzer',
  category: 'security',
  summary: 'Estimate password entropy and score strength with feedback.',
  description:
    'Analyze a password entirely on-device: report character-set entropy and bit strength, detect weakness from repetition, sequences, repeated characters, dictionary and common-password hits, and return a 0–100 score with concrete fix suggestions. Nothing is sent anywhere.',
  keywords: [
    'password strength',
    'password entropy',
    'password checker',
    'strong password',
    'entropy bits',
    'zxcvbn',
    'password security',
    'brute force',
    'password feedback',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'Check a password', input: 'Tr0ub4dor&3' },
    { title: 'Weak example', input: 'password123' },
    { title: 'Strong example', input: 'qX7!mpl3-Kwy@4z' },
  ],
  article: [
    {
      heading: 'What the score is built from',
      body: 'The analyzer inspects which character classes appear — lower, upper, digits and symbols — and how long the password is. Base points grow with length, more classes add points, and three or more classes earn a small bonus; 12+ characters adds a further boost. The result is clamped to 0–100 and labelled Weak, Fair or Strong, with under 50 treated as risky.',
    },
    {
      heading: 'The penalties that pull the score down',
      body: 'Four deductions then cut the score. A password on the built-in common list (password, qwerty, 123456 and dozens more) loses 45 points; an all-lowercase word loses 20; three or more repeated characters in a row loses 15; a contiguous run such as 123 or abc loses 12; and a length under 8 costs 20. Each penalty adds a concrete suggestion, so you can see exactly why the score fell and what to change.',
    },
    {
      heading: 'Entropy in bits and what it misses',
      body: 'A second column shows entropy in bits: length times the log base two of the pool, where the pool counts only the classes present — 26 lower, 26 upper, 10 digits and 33 symbols. This models brute-force search space and ignores patterns and words, which is exactly why the penalties exist. The password is analysed with plain JavaScript in this tab, so nothing is uploaded and no network call is made.',
    },
  ],
  faq: [
    {
      q: 'Is my password uploaded?',
      a: 'No. Analysis runs entirely in your browser; the value never leaves your machine.',
    },
    {
      q: 'What does the score mean?',
      a: '0–100 estimating resilience against automated guessing, balancing entropy, length and detectable patterns. Under 50 is risky for important accounts.',
    },
    {
      q: 'Does entropy guarantee security?',
      a: 'Entropy is only a model. Uniqueness, not being reused elsewhere, and using a password manager still matter.',
    },
  ],
  related: ['password', 'random-string', 'hash-identifier'],
  status: 'stable',
};
