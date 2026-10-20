import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'base64',
  name: 'Base64 Encode / Decode',
  category: 'encoding',
  summary: 'Convert text or files to and from Base64, with URL-safe and MIME line-wrap options.',
  description:
    'Encode UTF-8 text or a file’s bytes to Base64, or decode Base64 back to text or a downloadable file. Supports the URL-safe alphabet and 76-character MIME line wrapping. Runs entirely in your browser.',
  keywords: [
    'base64',
    'encode',
    'decode',
    'btoa',
    'atob',
    'url-safe',
    'base64url',
    'mime',
    'file',
    'binary',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'both',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Encode to Base64' },
        { value: 'decode', label: 'Decode from Base64' },
      ],
    },
    {
      key: 'urlSafe',
      label: 'URL-safe alphabet',
      type: 'boolean',
      default: false,
      help: 'Use - and _ instead of + and /, and drop padding.',
    },
    {
      key: 'wrap',
      label: 'Wrap at 76 chars (MIME)',
      type: 'boolean',
      default: false,
      help: 'Only affects encoding.',
      showWhen: { key: 'mode', value: 'encode' },
    },
    {
      key: 'outputName',
      label: 'Decoded file name',
      type: 'text',
      default: 'decoded.bin',
      help: 'Used when decoding to a saveable file.',
      showWhen: { key: 'mode', value: 'decode' },
    },
  ],
  examples: [
    { title: 'Encode "hello"', input: 'hello', options: { mode: 'encode' } },
    { title: 'Decode', input: 'aGVsbG8gd29ybGQ=', options: { mode: 'decode' } },
    { title: 'Emoji round-trips', input: 'I ❤ Toolbench', options: { mode: 'encode' } },
  ],
  faq: [
    {
      q: 'Does this handle Unicode correctly?',
      a: 'Yes. Text is encoded as UTF-8 first, so emoji and non-Latin scripts round-trip exactly. The naive btoa() approach throws on those; this tool does not.',
    },
    {
      q: 'What is the URL-safe alphabet?',
      a: 'RFC 4648 §5 replaces + with - and / with _ so the value is safe in URLs and filenames. Padding = is usually omitted.',
    },
    {
      q: 'Can I encode or decode a file?',
      a: 'Yes. Choose a file to encode its bytes as Base64 text, or switch to Decode and choose a Base64 text file to save the original bytes back as a file. The file stays on your device.',
    },
  ],
  related: ['base32', 'url-encode', 'hex', 'jwt-decode'],
  status: 'stable',
};
