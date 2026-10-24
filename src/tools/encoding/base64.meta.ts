import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'base64',
  name: 'Base64 Encode / Decode',
  category: 'encoding',
  summary: 'Convert text or a file to and from Base64, with URL-safe and MIME line-wrap options.',
  description:
    'Encode text or a whole file as Base64, or decode Base64 back to text or a file. Supports the URL-safe alphabet and 76-character MIME line wrapping. Runs entirely in your browser — nothing is uploaded.',
  keywords: ['base64', 'encode', 'decode', 'btoa', 'atob', 'url-safe', 'base64url', 'mime', 'file'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  accept: '',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Text → Base64' },
        { value: 'decode', label: 'Base64 → Text' },
      ],
    },
    {
      key: 'urlSafe',
      label: 'URL-safe alphabet',
      type: 'boolean',
      default: false,
      help: 'Use - and _ instead of + and /, and drop padding. Text input only.',
    },
    {
      key: 'wrap',
      label: 'Wrap at 76 chars (MIME)',
      type: 'boolean',
      default: false,
      help: 'Only affects encoding of typed text.',
      showWhen: { key: 'mode', value: 'encode' },
    },
    {
      key: 'outputName',
      label: 'Decoded filename',
      type: 'text',
      default: 'decoded.bin',
      help: 'Name for the file produced when decoding. Files only.',
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
      q: 'Can it encode a whole file?',
      a: 'Yes — drop a file on the workbench and it is encoded as a .base64.txt download. If a file is selected it is used instead of any text you typed.',
    },
  ],
  article: [
    {
      heading: 'Encoding and decoding text',
      body: 'In the default encode direction, typed text is converted to UTF-8 bytes and then to the standard RFC 4648 alphabet, so emoji and non-Latin scripts round-trip exactly rather than throwing like the naive atob and btoa pair. The decode direction accepts a Base64 string and turns it back into UTF-8 text, flagging a replacement character when the bytes are not valid text so you know the payload was something else. The URL-safe toggle swaps the plus and slash for hyphen and underscore and drops the padding, which is the alphabet for query strings and JWTs, and MIME wrap breaks encoded text every 76 characters for old mail software.',
    },
    {
      heading: 'Encoding and decoding a whole file',
      body: 'When a file is dropped on the workbench it wins over any pasted text, which the notes say plainly. Encoding reads the file in chunks so even a large binary is encoded without blowing the call stack, and hands back a .base64.txt download with a copy shown in the report. Decoding reads the file as text, so it accepts a data URI as well as a bare Base64 string — a truncated or malformed payload is an error, never a partial file — and the result downloads under the name you set, defaulting to decoded.bin.',
    },
    {
      heading: 'Lenient text versus strict files',
      body: 'The two paths apply different rules. Typed text is decoded leniently: surrounding whitespace is ignored, the URL-safe alphabet is accepted on input even when the toggle is off, and missing padding is added. A file is decoded strictly: it must be a complete, correctly padded string of the standard alphabet (after stripping whitespace or a data-URI prefix) or it is rejected outright. That asymmetry means a quick decode of a pasted value tolerates your formatting, while turning a dropped file back into bytes never silently returns a truncated copy.',
    },
    {
      heading: 'Where the conversion happens',
      body: 'Both directions run in the browser with no network request. Text is encoded or decoded with the Web TextEncoder and TextDecoder, and files are read, converted and handed back entirely in the tab. Nothing is uploaded, so a file you convert for embedding in a page, an email or an API call stays on your machine, and the same is true for any Base64 you paste in to reverse.',
    },
  ],
  related: ['base32', 'url-encode', 'hex', 'jwt-decode'],
  status: 'stable',
};
