/**
 * Editorial content for the hash tool page.
 *
 * Kept out of ``hash.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it computes',
      body: 'This tool takes the text you type and returns a cryptographic digest of it as a fixed-length string. The input is first encoded as UTF-8 bytes and then hashed with the algorithm you choose, so identical text always yields the same digest and multi-byte characters produce the same result as any other UTF-8 tool. You pick the algorithm and the output encoding separately, then read the digest straight out of the box.',
    },
    {
      heading: 'Choosing an algorithm',
      body: 'SHA-256, SHA-384 and SHA-512 are the ones to reach for in real use: they are collision-resistant and fine for checksums, signing and integrity checks. SHA-1 and MD5 are implemented here for compatibility with legacy systems and older data formats, but both are broken for collision resistance and should not be used where an attacker can influence the input. They remain useful as plain non-security checksums.',
    },
    {
      heading: 'Output encodings',
      body: 'Hex is the familiar 64-character (for SHA-256) digest you see in package listings and verification pages. Base64 is about a third shorter and useful in binary contexts, while the URL-safe variant swaps + and / for - and _ and strips the padding, so the digest drops straight into a URL or filename. When the output is hex you can also request uppercase letters for a more readable value.',
    },
    {
      heading: 'Under the hood',
      body: 'The SHA family digests come from the browser Web Crypto API, so the computation is native and fast. MD5 is a self-contained JavaScript implementation of RFC 1321, which is why this tool works offline and with no network access at all. There is no salt and no key here — this is a plain message digest, not a keyed hash.',
    },
    {
      heading: 'Privacy',
      body: 'Hashing happens entirely on your device. The text you type is encoded and digested in this tab and never transmitted anywhere, which is what makes it safe to hash a secret or a private token here.',
    },
  ],
  faq: [
    {
      q: 'Are MD5 and SHA-1 safe to use?',
      a: 'No. Both are broken for collision resistance and must not be used for signatures, certificates or content deduplication where an attacker can influence the input. They are still fine as non-security checksums. Use SHA-256 or stronger for anything security related.',
    },
    {
      q: 'Is the text hashed as UTF-8?',
      a: 'Yes. The input string is encoded to UTF-8 bytes before hashing, so multi-byte characters produce the same digest as other UTF-8 tooling.',
    },
    {
      q: 'What is the URL-safe Base64 option?',
      a: 'Standard Base64 with "+" and "/" replaced by "-" and "_" and the trailing "=" padding removed, so the digest can be dropped straight into URLs and filenames.',
    },
  ],
} as const;
