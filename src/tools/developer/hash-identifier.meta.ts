import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'hash-identifier',
  name: 'Hash Identifier',
  category: 'developer',
  summary: 'Guess which hash or password format a string is, from its length and character set.',
  description:
    'Paste a digest or password hash and get a ranked list of formats it could be: MD5, SHA-1/224/256/384/512, CRC32, NTLM, bcrypt, Argon2, PBKDF2, md5crypt, sha512crypt, MySQL 4.1 and base64. Detection is heuristic — hashes of the same length are indistinguishable by value alone.',
  keywords: [
    'hash identifier',
    'hash type',
    'identify hash',
    'hash analyzer',
    'hash analyser',
    'md5 or sha1',
    'bcrypt',
    'argon2',
    'ntlm',
    'password hash format',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'MD5 digest', input: '5d41402abc4b2a76b9719d911017c592' },
    {
      title: 'SHA-256 digest',
      input: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      title: 'bcrypt hash',
      input: '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
    },
  ],
  faq: [
    {
      q: 'Can it tell MD5 from NTLM?',
      a: 'No. They are both 32 hex characters, so both are listed. Confidence reflects how common each format is, not certainty.',
    },
    {
      q: 'Does it compute or crack the hash?',
      a: 'Neither. It only inspects the string shape — length, alphabet and any $prefix$ — entirely in your browser.',
    },
    {
      q: 'Why is base64 sometimes suggested?',
      a: 'A string whose length is a multiple of 4 and uses only A-Z a-z 0-9 + / = fits the base64 rule, so it is offered as a low-confidence option.',
    },
  ],
  related: [  "hex",
  "base64",
  "number-base",
  "chmod-calculator"],
  status: 'stable',
};
