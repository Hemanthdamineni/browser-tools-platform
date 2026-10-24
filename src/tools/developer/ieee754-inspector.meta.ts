import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ieee754-inspector',
  name: 'IEEE 754 Float Inspector',
  category: 'developer',
  summary: 'Decode and encode 32/64-bit floats: sign, exponent, mantissa, hex and bytes.',
  description:
    'Turn a decimal number into its exact IEEE 754 bit pattern, or paste a hex or binary pattern and read the float back. See the sign bit, exponent, mantissa, little- and big-endian bytes, and whether the value is normal, subnormal, zero, infinity or NaN.',
  keywords: [
    'ieee 754',
    'float to hex',
    'hex to float',
    'binary32',
    'binary64',
    'mantissa',
    'exponent',
    'subnormal',
    'float precision',
    'nan bits',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'inputMode',
      label: 'Input is',
      type: 'select',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'decimal', label: 'Decimal number' },
        { value: 'bits', label: 'Hex / binary bits' },
      ],
      default: 'auto',
    },
    {
      key: 'precision',
      label: 'Format for decimal input',
      type: 'select',
      choices: [
        { value: 'both', label: 'float32 and float64' },
        { value: 'float64', label: 'float64 (double)' },
        { value: 'float32', label: 'float32 (single)' },
      ],
      default: 'both',
    },
    {
      key: 'byteOrder',
      label: 'Byte order',
      type: 'select',
      choices: [
        { value: 'little', label: 'Little-endian' },
        { value: 'big', label: 'Big-endian' },
      ],
      default: 'little',
    },
    {
      key: 'groupBits',
      label: 'Group binary into bytes',
      type: 'boolean',
      default: true,
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      choices: [
        { value: 'table', label: 'Table' },
        { value: 'lines', label: 'Lines' },
      ],
      default: 'table',
    },
  ],
  examples: [
    {
      title: 'Why 0.1 is not exact',
      input: '0.1',
    },
    {
      title: 'Read a bit pattern back',
      input: '0x3FF0000000000000',
    },
    {
      title: 'Single-precision float32',
      input: '3.14',
      options: { precision: 'float32' },
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
  related: ['number-base', 'hex', 'text-to-binary', 'binary-file-signature'],
  status: 'stable',
};
