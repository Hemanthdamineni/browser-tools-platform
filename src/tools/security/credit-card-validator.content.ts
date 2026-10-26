/**
 * Editorial content for the credit-card-validator tool page.
 *
 * Kept out of ``credit-card-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the checks actually are',
      body: 'This tool runs two independent checks on a card number. First it applies the Luhn algorithm, the mod-10 checksum every card scheme uses, which catches a single mistyped or transposed digit. Then it matches the leading digits against the known Issuer Identification Number ranges to name the brand — Visa, Mastercard, American Express, Discover, Diners Club, JCB or UnionPay — and compares the number of digits against the lengths that brand allows. The result is a small table showing each check rather than a bare yes or no.',
    },
    {
      heading: 'When a card number needs checking offline',
      body: 'The usual case is a form you are building or debugging: you want to know why a test number is being rejected, or you need a well-formed sample number for a test fixture. It is also a quick way to confirm the card brand before deciding how to format the input, since Amex is 15 digits in a 4-6-5 grouping while Visa is 16 in 4-4-4-4.',
    },
    {
      heading: 'How the options change the verdict',
      body: 'Spaces and dashes are stripped before anything else, so a number copied in groups is fine; anything other than digits then fails outright. The Enforce the brand length switch decides whether a number that passes Luhn but is the wrong length for its brand counts as valid: leave it on for strict form checking, or turn it off when you are working with a scheme whose ranges this tool does not know.',
    },
    {
      heading: 'What this cannot tell you',
      body: 'A pass here means the number is well-formed, nothing more. It does not contact a bank or a payment network, so it cannot confirm that a real card exists, that it is not cancelled, or that it belongs to the person typing it. A number with no matching prefix still gets its Luhn check, and is reported as an unrecognised brand with no length requirement. Expiry dates, security codes and cardholder names are not part of this check.',
    },
    {
      heading: 'The number never leaves the page',
      body: 'Validation is arithmetic done in this tab. No card number is transmitted, no network request is made and nothing is logged, which is the reason to use a local checker rather than a service that might store what you paste — even for a test card.',
    },
  ],
  faq: [
    {
      q: 'Is this a real payment card check?',
      a: 'No — the result is a checksum (Luhn) and a formatting check only. It tells you whether the number is well-formed, not whether a real card exists. This never contacts a bank or network, and runs entirely on your device.',
    },
    {
      q: 'How is the brand detected?',
      a: 'From the leading digits: 4 for Visa, 51–55 and 2221–2720 for Mastercard, 34/37 for Amex, 6011/65/64x for Discover, and so on. Brand detection is for the Issuer Identification Number range only.',
    },
    {
      q: 'What if the brand is unknown?',
      a: 'The Luhn check still runs. Unknown prefixes are reported as an unrecognised brand with no length requirement, so the verdict rests on the checksum.',
    },
  ],
} as const;
