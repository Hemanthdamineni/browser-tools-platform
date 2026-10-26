/**
 * Editorial content for the hash-identifier tool page.
 *
 * Kept out of ``hash-identifier.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it can tell from a string alone',
      body: 'Paste a digest or password hash and the tool inspects its shape: total length, whether the alphabet is hexadecimal, and any recognised prefix. From that it ranks the formats the string could be — eight hex characters reads as CRC32, 32 as MD5 or NTLM, 40 as SHA-1, and so on up to SHA-512 at 128. Modern password formats that carry their own marker, such as bcrypt, Argon2, md5crypt and sha512crypt, are identified with high confidence because the $ prefix names the scheme.',
    },
    {
      heading: 'A concrete case',
      body: 'You inherit a database column of password hashes and need to know what produced them before you can plan a migration. Pasting one value tells you it starts with $2b$ — so it is bcrypt with the cost factor shown in the string — or with $argon2id$, or with a bare 32-hex digest that is most likely MD5. That single clue decides whether you keep verifying as-is or must force a reset.',
    },
    {
      heading: 'Why same-length hashes are ambiguous',
      body: 'Length and alphabet are all a static inspector has. MD5 and NTLM are both 32 hex characters and cannot be separated by value, so both are listed, and confidence reflects how common a format is rather than certainty. Similarly a string whose length is a multiple of four and fits the base64 alphabet is offered as a low-confidence base64 candidate, because encoded data and a digest can look identical.',
    },
    {
      heading: 'What it will not do, and privacy',
      body: 'It never computes, reverses or cracks anything: it only describes the string you paste, one token at a time, and it rejects input containing spaces since a hash is a single token. All inspection happens in the page with no lookup table and no network request, so a hash from a private system is never sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'Can it tell MD5 from NTLM?',
      a: 'No. They are both 32 hex characters, so both are listed. Confidence reflects how common each format is, not certainty.',
    },
    {
      q: 'Does it compute or crack the hash?',
      a: 'Neither. It only inspects the string shape — length, alphabet and any $prefix$ — entirely in your browser.',
    },
    {
      q: 'Why is base64 sometimes suggested?',
      a: 'A string whose length is a multiple of 4 and uses only A-Z a-z 0-9 + / = fits the base64 rule, so it is offered as a low-confidence option.',
    },
  ],
} as const;
