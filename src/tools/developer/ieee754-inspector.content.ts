/**
 * Editorial content for the ieee754-inspector tool page.
 *
 * Kept out of ``ieee754-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the IEEE 754 Inspector decodes',
      body: 'Paste a decimal number or a hex or binary bit pattern and the tool returns the sign bit, exponent bits with its unbiased value, mantissa in hex, the full 32 or 64-bit hex, grouped binary, little- or big-endian bytes, the value class and the nearest readable value. It works on several lines at once and can output a table or compact lines.',
    },
    {
      heading: 'When to use it',
      body: 'Reach for it when you need to see why 0.1 plus 0.2 is not 0.3, when you want the exact bytes of a float for a protocol or buffer dump, or when you have a stored pattern and want to know what number it represents.',
    },
    {
      heading: 'The options that shape the output',
      body: 'Input is auto-detected: a 32 or 64-character binary string or an 8 or 16-digit hex string is read as bits, anything else as a decimal. Precision chooses float64, float32 or both, byteOrder flips the byte display, groupBits toggles binary byte grouping, and format switches between a table and lines.',
    },
    {
      heading: 'Limits and rounding warnings',
      body: 'Input is capped at 100,000 characters across 500 lines. Decimal values that cannot be represented exactly are flagged as precision losses, values too large overflow to Infinity, and values too small underflow to zero, so you are told when the shown float is not the number you typed.',
    },
    {
      heading: 'Where the analysis runs',
      body: 'The bit arithmetic happens entirely on your device in this tab, and the numbers you paste are never sent to a server.',
    },
  ],
  faq: [
    {
      q: 'How does auto-detect tell numbers from bit patterns?',
      a: 'A string of only 0s and 1s that is exactly 32 or 64 characters long is read as binary bits, and an 8 or 16 digit hex string is read as bits whenever it has a 0x prefix or contains a letter A-F. Anything else is parsed as a decimal number.',
    },
    {
      q: 'Why does 0.1 not look exact?',
      a: 'Binary floating point cannot represent 0.1 exactly. The inspector shows the nearest representable value and flags when a decimal number had to be rounded, which is the usual cause of 0.1 + 0.2 !== 0.3.',
    },
    {
      q: 'What is a subnormal number?',
      a: 'When the exponent bits are all zero the leading 1 is dropped and the value becomes mantissa times two to the power of the smallest normal exponent. These subnormals let the format represent values close to zero with reduced precision.',
    },
    {
      q: 'Which endianness are the bytes shown in?',
      a: 'Whatever you select. Little-endian is the default because x86, ARM and RISC-V all store floats that way, so it matches what you see in a hex dump of memory.',
    },
  ],
} as const;
