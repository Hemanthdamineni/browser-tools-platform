/**
 * Editorial content for the email-validator tool page.
 *
 * Kept out of ``email-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
