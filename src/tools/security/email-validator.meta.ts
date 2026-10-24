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
  article: [
    {
      heading: 'Every rule, reported separately',
      body: 'The address is split at its single @ and each rule gets its own row: whitespace, the number of @ signs, local-part length and characters, domain length, label count and label rules, the top-level domain, the total length, and the verdict. A failing rule carries a reason instead of a bare Invalid.',
    },
    {
      heading: 'Rules for the part before the @',
      body: 'The local part must be 1 to 64 characters drawn from letters, digits, dot, percent, plus, hyphen and the RFC specials (! # $ & * / = ? ^ _ ` { | } ~). A dot may not start, end or repeat, so ada.smith+tag@ passes while .ada@ and ada..b@ do not.',
    },
    {
      heading: 'Domains, labels and the TLD switch',
      body: 'The domain may be up to 253 characters, split into labels of 1 to 63 made of letters, digits and internal hyphens; at least two labels are required, so a bare hostname fails. Require a two-letter or more top-level domain is on by default — switch it off to accept a last label such as a number, as in dev@intranet.42.',
    },
    {
      heading: 'Syntax is all this checks',
      body: 'Passing means the address is shaped like an email address, not that the mailbox exists. Delivery can only be confirmed by talking to the mail server, which this tool never does. Addresses longer than 300 characters are refused before any check runs.',
    },
    {
      heading: 'The address never leaves your device',
      body: 'The rule set is ordinary JavaScript running in this tab. Your address is not sent to a validator, no request leaves the page, and the check keeps working with the network turned off.',
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
    {
      title: 'A numeric last label without the TLD rule',
      input: 'dev@intranet.42',
      options: { requireTld: false },
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
