/**
 * Editorial content for the bcrypt tool page.
 *
 * Kept out of ``bcrypt.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What bcrypt hashing does',
      body: 'bcrypt turns a password into a 60-character hash that also embeds a random salt and the cost factor that produced it. Because the salt is part of the output, the same password hashed twice gives two different strings, which defeats precomputed rainbow tables. The stored value is safe to keep in a database exactly as shown.',
    },
    {
      heading: 'Choosing a cost factor',
      body: 'The cost factor is the base-2 logarithm of the number of key-expansion rounds, so every increment doubles the work for both the defender and an attacker. A cost of 10 is the common default and takes about a tenth of a second; 12 to 14 is a sensible target for modern hardware, while 15 can take several seconds. The tool prints a rough estimate for whichever cost you pick.',
    },
    {
      heading: 'Verifying an existing hash',
      body: 'Switch to verify mode, paste the password in the input box and the stored hash in the option field. bcrypt re-reads the salt and cost from the hash itself, so you never have to supply them separately. The result is a clear match or no-match answer; a malformed hash is rejected with a helpful message rather than a silent failure.',
    },
    {
      heading: 'Why the work runs in a worker',
      body: 'bcrypt is deliberately CPU-heavy, so at higher costs the calculation would freeze the page if it ran on the main thread. This tool runs it in a Web Worker, meaning the interface stays responsive, progress can be shown, and you can cancel a long run. Nothing is uploaded: the worker is a thread inside your own browser tab.',
    },
  ],
  faq: [
    {
      q: 'Is my password sent anywhere?',
      a: 'No. Hashing and verification run entirely in your browser inside a Web Worker. The password is never transmitted, logged, or stored by this page.',
    },
    {
      q: 'What cost factor should I use?',
      a: 'The default 10 is a reasonable baseline (roughly 0.1 s). Higher values (12–15) resist brute force better but are noticeably slower; the tool shows an estimated time for the cost you choose.',
    },
    {
      q: 'What does a bcrypt hash look like?',
      a: 'A bcrypt hash starts with $2a$, $2b$, $2x$ or $2y$, followed by a two-digit cost and a 53-character payload. For example: $2b$10$EZHlFIQcLaXBPdVq9vdDC.OFujeyPmE613GmGj.itHbjbhCYA8J.2.',
    },
  ],
} as const;
