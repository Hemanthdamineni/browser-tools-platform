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
  related: ['number-base', 'hex', 'text-to-binary', 'binary-file-signature'],
  status: 'stable',
};
