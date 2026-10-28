/**
 * Editorial content for the crc-calculator tool page.
 *
 * Kept out of ``crc-calculator.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'The calculator computes CRC checksums from a catalogue of named presets — CRC-8/ATM, CRC-16/MODBUS, CRC-32/ISO-HDLC (the one in zip, gzip and PNG), CRC-32C/Castagnoli (iSCSI and ext4), CRC-64/XZ and more — or from your own width, polynomial, initial value, reflection flags and final XOR, so any variant you need can be reproduced exactly. The result is shown as hex and decimal with the right number of digits for the chosen width, and a reference check value over the ASCII string "123456789" is always computed so you can confirm a preset matches the published definition.',
    },
    {
      heading: 'What a CRC is (and is not)',
      body: 'A CRC is a short fixed-size fingerprint of a file or message, designed to catch accidental corruption in storage or transmission: two documents that differ usually produce different CRCs, and CRC-32 can detect every burst error up to 32 bits. It is not cryptographically secure. Two inputs can collide on purpose, and an attacker can craft a different file with the same CRC-32, so use a real cryptographic hash when integrity must resist tampering rather than noise.',
    },
    {
      heading: 'The parameters behind a preset',
      body: 'Every named preset expands to the same five parameters: width in bits, the polynomial (top bit dropped), the initial register value, whether input bytes and the final result are bit-reflected, and a final XOR mask. The tool prints these next to the result, so when two CRC tools disagree, the parameters are usually the reason.',
    },
    {
      heading: 'Running on a file or pasted text',
      body: 'Drop any file into the workbench, or type text — the same computation runs over the file bytes (including binary) or the UTF-8 encoding of what you typed. Nothing is uploaded; the checksum is computed entirely in this tab.',
    },
  ],
  faq: [
    {
      q: 'Is a strong CRC the same as a hash?',
      a: 'No. CRC is a fast error-detection code, deliberately easy to invert and small enough to be fast in hardware. It is appropriate for detecting accidental corruption, not for verifying authenticity: anyone can build a second file with the same CRC-32, so use SHA-256 or similar when tampering is the threat.',
    },
    {
      q: 'Why does the same polynomial produce different CRCs in two tools?',
      a: 'A CRC is defined by more than the polynomial alone. Width, initial value, reflected input/output and the final XOR all change the result, and even the byte order of the input matters. The named presets here encode all five parameters, and the tool shows them, so you can compare against whatever the other tool documents.',
    },
    {
      q: 'What is the "123456789" check value?',
      a: 'The ASCII string "123456789" is a convention for validating CRC implementations: the CRC Catalogue (reveng.sourceforge.net) publishes each preset with its expected CRC of that string. Every run here computes it, so you can confirm the parameters you entered are implemented as named.',
    },
    {
      q: 'Can I compute a CRC-64 over very large files?',
      a: 'Yes — the input is processed incrementally in chunks, so the file never needs to fit in memory at once. Only the final register value is kept.',
    },
  ],
} as const;
