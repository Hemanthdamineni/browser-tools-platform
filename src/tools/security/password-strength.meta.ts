import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'password-strength',
  name: 'Password Strength Analyzer',
  category: 'security',
  summary: 'Estimate password entropy and score strength with feedback.',
  description: 'Analyze a password entirely on-device: report character-set entropy and bit strength, detect weakness from repetition, sequences, repeated characters, dictionary and common-password hits, and return a 0–100 score with concrete fix suggestions. Nothing is sent anywhere.',
  keywords: ['password strength', 'password entropy', 'password checker', 'strong password', 'entropy bits', 'zxcvbn', 'password security', 'brute force', 'password feedback'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'Check a password', input: 'Tr0ub4dor&3' },
    { title: 'Weak example', input: 'password123' },
  ],
  faq: [
    { q: 'Is my password uploaded?', a: 'No. Analysis runs entirely in your browser; the value never leaves your machine.' },
    { q: 'What does the score mean?', a: '0–100 estimating resilience against automated guessing, balancing entropy, length and detectable patterns. Under 50 is risky for important accounts.' },
    { q: 'Does entropy guarantee security?', a: 'Entropy is only a model. Uniqueness, not being reused elsewhere, and using a password manager still matter.' },
  ],
  related: ['password', 'random-string', 'hash-identifier'],
  status: 'stable',
};
