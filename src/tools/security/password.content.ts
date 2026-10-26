/**
 * Editorial content for the password tool page.
 *
 * Kept out of ``password.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the Password Generator produces',
      body: 'It builds one or many random passwords from the character classes you tick, then joins them with newlines and offers the batch as passwords.txt, alongside the pool size, an entropy estimate in bits and a plain strength word.',
    },
    {
      heading: 'Choosing length and character classes',
      body: 'Length runs from 4 to 128 characters, defaulting to 20, and how many runs from 1 to 50. Uppercase, lowercase, digits and symbols are all on by default; turning one off shrinks the pool the tool draws from. At least one character from every class you keep is guaranteed, which matters for sites that demand a symbol.',
    },
    {
      heading: 'Bias, ambiguity and the entropy figure',
      body: 'Every character comes from crypto.getRandomValues with rejection sampling, so no value is more likely than another. Avoid ambiguous characters strips zero, O, one, l, I, the pipe and the backtick for pools you have to read aloud or retype. Entropy is log2 of the pool size times length, and the strength word runs from very weak under 28 bits to very strong at 128 and up.',
    },
    {
      heading: 'Nothing to upload, nothing to log',
      body: 'Generation is local and offline, so the passwords are never transmitted or logged by the tool; you alone hold them the moment they appear.',
    },
  ],
  faq: [
    {
      q: 'How is “no modulo bias” achieved?',
      a: 'Random bytes are read as unsigned 32-bit integers and any value in the short final block that would skew the distribution is discarded and re-drawn (rejection sampling), so every character in the pool is equally likely.',
    },
    {
      q: 'What does the entropy figure mean?',
      a: 'It is log2(pool size) × length, the number of bits an attacker must brute-force on average. 20 characters from a ~90-character pool is roughly 129 bits.',
    },
    {
      q: 'Is anything sent anywhere?',
      a: 'No. Generation is local and offline; the passwords never leave your device.',
    },
  ],
} as const;
