import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'email-validator',
  name: 'Email Validator',
  category: 'security',
  summary:
    'Validate an email address: structure, local-part rules, domain labels, TLD and length limits.',
  description:
    'Check an email address the same way forms do: a well-formed local part (the 64-character rule set, no leading/trailing dots), a domain with valid labels, a two-letter-plus top-level domain, and the 254-character limit. Every check is reported, so you see exactly why an address passes or fails. Everything runs on your device.',
  keywords: [
    'email validator',
    'validate email',
    'check email format',
    'email pattern',
    'valid email address',
    'email regex',
    'check email syntax',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'requireTld',
      label: 'Require a two-letter or more top-level domain',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A normal address',
      input: 'ada@example.com',
    },
    {
      title: 'A subdomain address',
      input: 'user.name+tag@mail.example.co.uk',
    },
  ],
  faq: [
    {
      q: 'Does this check whether the mailbox exists?',
      a: 'No. This is a format check only — it validates the structure so a valid-looking address can be entered, but confirming a mailbox exists requires contacting the mail server, which this tool does not do.',
    },
    {
      q: 'Which characters are allowed in the local part?',
      a: 'Letters, digits and the common specials in W3C’s email spec (dot, plus, underscore, hyphen, percent, slash and a few more). Dots cannot start or end the local part, and double dot is rejected.',
    },
    {
      q: 'What length limits apply?',
      a: 'The local part must be 1–64 characters, the domain 1–253 (in whole labels of up to 63), and the total address at most 254 — the real limits email systems use.',
    },
  ],
  related: ['password-strength', 'url-parse', 'http-status', 'mime-lookup'],
  status: 'stable',
};
