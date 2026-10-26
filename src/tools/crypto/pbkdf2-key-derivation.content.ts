/**
 * Editorial content for the pbkdf2-key-derivation tool page.
 *
 * Kept out of ``pbkdf2-key-derivation.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The passphrase is the input',
      body: 'Whatever you type in the box is treated as the passphrase; the tool imports it as raw key material and stretches it with PBKDF2. The result is a table listing the algorithm, iteration count, salt size, salt in hex, passphrase length, derived key in hex and base64, and how long the derivation took.',
    },
    {
      heading: 'Reproducing a stored password hash',
      body: 'A practical use is confirming a hash from a database dump: set the PRF hash, iteration count, salt and key length to the values stored with the user record, type the candidate password, then paste the stored hash into the verify box to get Match or Mismatch. The byte comparison runs in constant time.',
    },
    {
      heading: 'Choosing the parameters',
      body: 'The hash selector picks SHA-1, SHA-256 or SHA-512, the iteration box defaults to 600000, key length defaults to 32 bytes, and the salt is read as UTF-8 text unless you switch it to hex or base64. The derived key can be shown as hex or base64.',
    },
    {
      heading: 'Caps and weak-setting warnings',
      body: 'Iterations above five million and keys longer than 1024 bytes are refused so the page stays responsive. Below the OWASP count for the chosen hash, with salts under eight bytes, or with a very short passphrase, the tool still runs but prints a warning. Stretching cannot add entropy that was never there.',
    },
    {
      heading: 'Derivation never goes online',
      body: 'The work is done by the browser Web Crypto API inside the tab. No passphrase, salt or hash is uploaded, and the page makes no network requests.',
    },
  ],
  faq: [
    {
      q: 'What is PBKDF2 used for?',
      a: 'PBKDF2 turns a low-entropy passphrase into a fixed-length key by hashing it together with a salt many thousands of times. It is used for password storage (Django, WPA2, 1Password exports), for deriving encryption keys from passphrases, and for key stretching before use with AES or HMAC.',
    },
    {
      q: 'How many iterations should I use?',
      a: 'OWASP currently recommends 600,000 iterations for PBKDF2-HMAC-SHA256 and 210,000 for SHA-512. Higher counts slow attackers proportionally, so pick the largest number your sign-in latency budget allows.',
    },
    {
      q: 'Why is a salt required?',
      a: 'A salt prevents identical passphrases from producing identical keys and defeats precomputed rainbow tables. Never reuse a salt across users, and store it next to the hash so verification can repeat the derivation.',
    },
    {
      q: 'Is my passphrase sent anywhere?',
      a: 'No. Derivation runs locally with the browser Web Crypto API, and the page makes no network requests at all.',
    },
    {
      q: 'How does verification work?',
      a: 'Paste the expected key (hex or base64) into the verify field. The tool re-derives the key and compares the bytes in constant time, reporting Match or Mismatch — the same check a server performs when you sign in.',
    },
    {
      q: 'How is the expected key interpreted?',
      a: 'An even number of hex digits (spaces, colons and dashes are ignored) is read as hex; anything else is decoded as base64. Match the output encoding to whatever format your stored hash uses.',
    },
  ],
} as const;
