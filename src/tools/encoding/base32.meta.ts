import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'base32',
  name: 'Base32 Encode / Decode',
  category: 'encoding',
  summary: 'RFC 4648 Base32 and Crockford Base32 encoding and decoding of text.',
  description:
    'Encode text to Base32 (case-insensitive, no ambiguous characters) or decode it back. Supports the standard RFC 4648 alphabet and Crockford’s variant used for IDs.',
  keywords: ['base32', 'rfc 4648', 'crockford', 'encode', 'decode', 'totp'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Text → Base32' },
        { value: 'decode', label: 'Base32 → Text' },
      ],
    },
    {
      key: 'variant',
      label: 'Alphabet',
      type: 'select',
      default: 'rfc4648',
      choices: [
        { value: 'rfc4648', label: 'RFC 4648 (A–Z 2–7)' },
        { value: 'crockford', label: 'Crockford (0–9 A–Z, no I L O U)' },
      ],
    },
    { key: 'padding', label: 'Add = padding (RFC only)', type: 'boolean', default: true },
    {
      key: 'lowercase',
      label: 'Lowercase output',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'encode' },
    },
  ],
  examples: [
    { title: 'Encode "hello"', input: 'hello', options: { mode: 'encode' } },
    { title: 'Decode', input: 'NBSWY3DP', options: { mode: 'decode' } },
    { title: 'Encode with Crockford', input: 'Hello', options: { variant: 'crockford' } },
  ],
  article: [
    {
      heading: 'Rewriting text as Base32 and back',
      body: 'Type or paste text and the tool rewrites it in the RFC 4648 alphabet of A–Z and 2–7, or decodes an existing Base32 string back to UTF-8. Input is read as UTF-8 bytes, so an emoji or accented letter spans several Base32 characters; decoding strips trailing = padding and any whitespace before rebuilding the byte sequence.',
    },
    {
      heading: 'RFC 4648 versus Crockford',
      body: 'RFC 4648 is the classic standard, padded with = up to a multiple of eight characters. Crockford’s alphabet adds all ten digits and drops the ambiguous letters I, L, O and U, which is why it turns up in identifiers meant to be read aloud; it is never padded. Decoding Crockford folds the look-alike letters back onto the right digits.',
    },
    {
      heading: 'When Base32 beats Base64',
      body: 'Reach for Base32 when the output has to survive human handling: a setup code emailed to a colleague, a licence key typed from a screen, or a token pasted into a case-insensitive filename or URL. Base64’s mixed case and symbols break in those places, while Base32’s uppercase-only alphabet does not.',
    },
    {
      heading: 'Options and edge cases',
      body: 'Padding applies to the RFC alphabet only, so ticking Add = padding while Crockford is selected changes nothing. Lowercase output is an encode-side style choice and still decodes to the same bytes. An invalid character stops decoding with an error instead of guessing, and bytes that are not valid UTF-8 come back as replacement characters.',
    },
    {
      heading: 'Nothing leaves your browser',
      body: 'Both directions run in the page with no network access, so a key or secret you are formatting is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'Why use Base32 over Base64?',
      a: 'Base32 is case-insensitive and avoids look-alike characters, so it survives being read aloud, typed by hand, or put in a filename or URL. TOTP secrets use it.',
    },
    {
      q: 'What is the difference between the RFC 4648 and Crockford alphabets?',
      a: 'RFC 4648 uses A–Z and the digits 2–7 and pads to a multiple of eight characters with =. Crockford’s variant uses all ten digits plus the letters without I, L, O and U, so the look-alike characters are gone, and it is never padded. When decoding Crockford input, O is read as 0 and I or L as 1.',
    },
    {
      q: 'What happens if I paste text with spaces or line breaks?',
      a: 'Decoding ignores whitespace as well as trailing = padding, so a Base32 string split across several lines still decodes. Encoding never emits whitespace — it always produces one continuous run of characters.',
    },
  ],
  related: ['base64', 'base58', 'hex'],
  status: 'stable',
};
