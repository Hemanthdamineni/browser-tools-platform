/**
 * Editorial content for the checksum-validator tool page.
 *
 * Kept out of ``checksum-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Three checksums in one tool',
      body: 'Luhn validates payment-card-like numbers (12–19 digits) with the mod-10 algorithm, IBAN uses the MOD-97 scheme on the rearranged alphanumeric string, and ISBN-10 and ISBN-13 check the weighted modulo-11 and modulo-10 check digits. Enter one identifier per line and the tool checks several at once, reporting each result as Valid or Invalid with a short reason, then a count of how many passed.',
    },
    {
      heading: 'The point of a checksum',
      body: 'A check digit exists to catch transcription errors — a swapped pair, a mistyped digit, a lost space — before a value reaches an account, a card or a book record. Verifying it is a cheap first gate: a failed check means the identifier cannot be right, while a pass only means the digits are internally consistent, nothing more.',
    },
    {
      heading: 'How auto-detection decides',
      body: 'Auto-detect looks at the characters: values containing letters are tried as IBAN (two letters, two digits, then up to 30 alphanumerics) or as an ISBN; a pure digit string of exactly 13 characters is checked as ISBN-13, otherwise digit-only input goes to Luhn. Spaces and hyphens are stripped before the check, so formatted values like 4111 1111 1111 1111 or 0-306-40615-2 work as pasted.',
    },
    {
      heading: 'What it does not prove, and privacy',
      body: 'A valid checksum never confirms that an account exists, a card is active or an ISBN is a real publication — the tool contacts nothing and performs no lookups — so use synthetic test data, never live payment credentials. Every check runs locally in the page with no request, so an identifier from a private system is never sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'Does a valid checksum mean a card or account is real?',
      a: 'No. A valid checksum only means that the identifier is structurally consistent. It does not contact a bank, confirm account ownership, or establish that a card is active. Use synthetic test data, not live payment credentials.',
    },
    {
      q: 'How does auto-detection work?',
      a: 'Values containing letters are checked as possible IBAN or ISBN identifiers. Digit-only values are checked as ISBN-13 when 13 digits long, otherwise as Luhn candidates. Choose a format explicitly when in doubt.',
    },
    {
      q: 'Is my input sent to a server?',
      a: 'No. All checks run locally in your browser and no network requests are made.',
    },
  ],
} as const;
