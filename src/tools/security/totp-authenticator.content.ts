/**
 * Editorial content for the totp-authenticator tool page.
 *
 * Kept out of ``totp-authenticator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The secret is the input',
      body: 'TOTP works from a shared secret, not an account name. Paste the base32 string that sits after secret= in an otpauth:// URI — something like JBSWY3DPEHPK3PXP — and the tool computes the codes for the current, previous and next time window, with the seconds left in the current one.',
    },
    {
      heading: 'Generating versus verifying',
      body: 'In codes mode you get a three-row table: the current code with its remaining lifetime, the previous window and the next one. In verify mode the input is the secret followed by the code to check, separated by a space, and the result row says Valid or Invalid and explains which window matched. The tolerance is one step either side of now, so a code typed just as the window rolls over still verifies.',
    },
    {
      heading: 'Digits and period',
      body: 'Standard TOTP is six digits on a 30-second period, which is what most services issue; eight digits and a 60-second period are less common but supported. Both must match whatever the issuer used — a six-digit code checked as eight will never match.',
    },
    {
      heading: 'Clock drift and the base32 format',
      body: 'TOTP depends on the clock. If every code is rejected, check the device time first — the ±1 step tolerance covers a few seconds, not minutes. The secret must be valid base32 (A–Z and 2–7 only); padding and spaces are tolerated, but any other character is refused rather than producing a wrong code.',
    },
    {
      heading: 'Nothing is stored or sent',
      body: 'The HMAC-SHA-1 is computed with the browser WebCrypto API entirely in this tab. No request is made and the secret is not saved between visits. Keep a real authenticator app or a secure backup of the secret as well.',
    },
  ],
  faq: [
    {
      q: 'Where do I find the secret?',
      a: 'Scan or open the otpauth:// URI your service provides; the secret is the base32 string after "secret=".',
    },
    {
      q: 'Does this replace my authenticator app?',
      a: 'Conveniently yes on this machine, but keep a real app or secure backup of your secrets too, since codes are generated on launch and nothing is stored.',
    },
    {
      q: 'Why is my verify failing?',
      a: 'Check the secret (base32 without spaces), digits, and that your device clock is roughly correct — the window tolerance covers a few seconds of drift.',
    },
  ],
} as const;
