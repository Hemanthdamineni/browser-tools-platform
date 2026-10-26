/**
 * Editorial content for the luhn-validator tool page.
 *
 * Kept out of ``luhn-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the Luhn check proves',
      body: 'Luhn, also called modulus 10, is the checksum behind credit card numbers, IMEIs and many national identifiers. The tool takes a number, strips spaces and dashes, and reports whether the weighted digit sum is a multiple of ten. A pass means the digits are internally consistent — it says nothing about whether the account exists or was ever issued.',
    },
    {
      heading: 'Three modes',
      body: 'Validate checks a complete number and, when the leading digits look like a known issuer, names the network it resembles. Compute check digit takes a number without its final digit and returns the digit that would complete it, showing why. Generate does the same and appends the result, which is handy when you need a syntactically valid test number for a form or fixture.',
    },
    {
      heading: 'The right way to make test numbers',
      body: 'Payment sandboxes often reject a number that fails Luhn before it reaches the mock. Paste any prefix in generate mode and the tool appends the correct check digit, so you get a number a front-end validator accepts without copying a real card. It is still not a real account.',
    },
    {
      heading: 'Limits and separators',
      body: 'Input may contain only digits, spaces and dashes; anything else is rejected rather than stripped, and a validate run needs at least two digits. The issuer hint is a best-effort prefix match against Visa, Mastercard, Discover and American Express, shown as context, never as proof.',
    },
    {
      heading: 'Numbers never leave the tab',
      body: 'The checksum is computed locally with plain integer arithmetic. Running the check on your own machine avoids sending anything to a third party, and the tool needs no network at all.',
    },
  ],
  faq: [
    {
      q: 'What is Luhn?',
      a: 'The mod-10 algorithm used as a quick validity check for numbers that include a check digit, such as credit cards and IMEIs.',
    },
    {
      q: 'Does Luhn guarantee a real card?',
      a: 'No — passing Luhn only verifies the number is well-formed; it gives no signal about issuer, funds, or account status.',
    },
    {
      q: 'How is the check digit computed?',
      a: 'Process digits from the right, doubling every second one and subtracting 9 from results over 9, then choose the digit that makes the sum a multiple of 10.',
    },
  ],
} as const;
