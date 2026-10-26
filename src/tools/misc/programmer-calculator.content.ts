/**
 * Editorial content for the programmer-calculator tool page.
 *
 * Kept out of ``programmer-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Evaluating integer expressions',
      body: 'Type an expression and the calculator parses it with BigInt, so nothing overflows: literals accept decimal, 0x hex, 0b binary and 0o octal prefixes, and the operators cover arithmetic, bitwise AND OR XOR NOT, and the shifts <<, >> and unsigned >>>. Parentheses and unary plus, minus and ~ are supported too.',
    },
    {
      heading: 'Reading the result table',
      body: 'The result is shown as a table: DEC, HEX, OCT and BIN together with the fixed-width two’s-complement value for the chosen bit width and a count of set bits. BIN is grouped in nibbles for readability, and the two’s-complement column is padded to the full width of the word.',
    },
    {
      heading: 'Bits and signedness',
      body: 'Bit width selects 8, 16, 32 or 64 and fixes how the binary and two’s-complement columns are padded. Interpret as signed flips the DEC column to the signed reading of that same word — the raw bit pattern does not change, only how DEC reports it.',
    },
    {
      heading: 'Edge cases and errors',
      body: 'Division and modulo throw on a zero divisor anywhere in the expression. Shift counts must sit between 0 and 1024, and any character that is not a digit, operator, parenthesis or valid literal prefix stops parsing with a message naming the offending character.',
    },
    {
      heading: 'Runs entirely in this tab',
      body: 'Tokenising, parsing and rendering all happen in the page, so no expression is ever uploaded.',
    },
  ],
  faq: [
    {
      q: 'How do I write a number in binary or hex?',
      a: 'Use the standard prefixes: 0x for hex, 0b for binary and 0o for octal. A bare decimal number needs no prefix. Mixed notations work in one expression, so 0xFF + 1 is fine.',
    },
    {
      q: 'What does Interpret as signed change?',
      a: 'It only changes how the DEC column is read. The raw bit pattern and the binary, octal, hex and two’s-complement columns are identical either way; signed mode reports DEC as the signed interpretation of that bit width, so 0xFF at 8 bits shows as −1 instead of 255.',
    },
    {
      q: 'What is the unsigned right shift (>>>)?',
      a: 'It shifts right and fills the freed high bits with zeroes instead of replicating the sign bit the way the plain >> does. It works on the 64-bit unsigned value, so results follow the 64-bit two’s-complement layout of the expression.',
    },
  ],
} as const;
