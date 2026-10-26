/**
 * Editorial content for the crc32 tool page.
 *
 * Kept out of ``crc32.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the output is',
      body: 'The text you type is encoded as UTF-8 and the chosen checksum is computed over exactly those bytes. Hex output is always eight digits, zero-padded and big-endian, matching what zip and gzip report; decimal output is the unsigned 32-bit value, so it can reach 4294967295. The stats line repeats the variant, the byte count and both forms.',
    },
    {
      heading: 'Picking the algorithm',
      body: 'Choose CRC-32 when you must reproduce a value already stored inside a zip, gzip or PNG stream. Choose CRC-32C (Castagnoli) when you are matching storage formats such as iSCSI, ext4 or Btrfs that use that polynomial. Choose Adler-32 for the zlib checksum, which is cheaper to compute but weaker at catching certain bit patterns.',
    },
    {
      heading: 'Options that matter',
      body: 'The Algorithm select fixes which lookup table is used, Output switches between hex and decimal, and Uppercase hex applies only while the hex form is shown, so it is ignored for decimal. A trailing newline changes the result because it is part of the bytes, so only compare checksums taken over identical text.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Empty input returns an empty output rather than the checksum of zero bytes. Only text is accepted, so there is no way to checksum raw binary here, and no parameter for a custom polynomial or initial value. The two tables are built once in the page and every computation runs locally with nothing uploaded.',
    },
  ],
  faq: [
    {
      q: 'Is CRC-32 a hash?',
      a: 'No. CRC-32 and Adler-32 are error-detection checksums. They reliably catch accidental corruption but are trivial to forge, so never use them for security or integrity against a malicious party.',
    },
    {
      q: 'How do CRC-32 and CRC-32C differ?',
      a: 'They use different polynomials. CRC-32 (reversed 0xEDB88320) is used by zip, gzip and PNG; CRC-32C (reversed 0x82F63B78, Castagnoli) is used by iSCSI, ext4, Btrfs and the SSE4.2 CRC instruction.',
    },
    {
      q: 'What byte order is the hex output?',
      a: 'The checksum is shown as a big-endian, zero-padded 8-digit hex number, matching the value reported by zip and gzip tooling.',
    },
  ],
} as const;
