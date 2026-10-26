/**
 * Editorial content for the otp-uri tool page.
 *
 * Kept out of ``otp-uri.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Building the URI an authenticator scans',
      body: 'This generates an otpauth:// provisioning URI for TOTP or HOTP. It produces a fresh base32 secret with crypto.getRandomValues, or validates and normalises a base32 secret you paste. The output is the URI plus a "Secret (base32)" line for apps that cannot scan a QR code.',
    },
    {
      heading: 'Enrolment for a service you are building',
      body: 'Use it to construct the enrolment link or QR payload for your own app, to check that the URI your backend produced is well-formed before shipping, or to mint a secret for a test account. Hand the output to any QR generator and the authenticator picks up the issuer, account and parameters.',
    },
    {
      heading: 'The parameters that matter',
      body: 'Type switches between time-based TOTP, which uses Period (15–120 s, default 30), and counter-based HOTP, which uses Initial counter instead. Issuer and Account shape the label the user sees. Secret (base32, empty = generate) lets you supply your own; otherwise Random secret bytes (16–64, default 20) decides the entropy. Code digits selects 6 or 8 and Hash algorithm SHA1, SHA256 or SHA512.',
    },
    {
      heading: 'Caveats',
      body: 'The tool builds the URI only — it never computes a live code. Issuer and account are percent-encoded in the path and the parameters URL-encoded, as the Key URI Format requires. A pasted secret must use only A–Z and 2–7, and padding is stripped before use.',
    },
    {
      heading: 'Generated on your device',
      body: "The random secret comes from the browser's cryptographic random source and never leaves the page; no URI or secret is uploaded. Treat a 2FA secret like a password anyway, because whoever holds it can generate your codes.",
    },
  ],
  faq: [
    {
      q: 'Does this show my current 6-digit code?',
      a: 'No — this tool builds the provisioning URI only. Computing a live code needs the current time and HMAC; pair the URI with the QR Code Generator to enrol in your authenticator app.',
    },
    {
      q: 'Is my secret safe?',
      a: 'It is generated in your browser with crypto.getRandomValues and never leaves the device. Still, treat any 2FA secret like a password: anyone who has it can generate your codes.',
    },
    {
      q: 'Which parameters do authenticator apps actually read?',
      a: 'Almost all of them read secret, issuer and account, and TOTP apps also honour digits, algorithm and period. HOTP apps need counter. Some older clients ignore the algorithm parameter and assume SHA1, so a SHA256 URI may not scan correctly everywhere.',
    },
  ],
} as const;
