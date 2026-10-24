import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-disposition',
  name: 'Content-Disposition Builder & Parser',
  category: 'web',
  summary: 'Build or inspect Content-Disposition download and inline headers.',
  description:
    'Generate a safe Content-Disposition response header for inline display or downloads, or parse pasted headers to inspect disposition, filename, and filename* parameters. Processing stays in your browser.',
  keywords: [
    'content-disposition',
    'download header',
    'filename header',
    'attachment header',
    'inline header',
    'RFC 6266',
    'filename star',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'parse',
      choices: [
        { value: 'parse', label: 'Parse headers' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'disposition',
      label: 'Disposition',
      type: 'select',
      default: 'attachment',
      choices: [
        { value: 'attachment', label: 'attachment (download)' },
        { value: 'inline', label: 'inline (display)' },
      ],
    },
    { key: 'filename', label: 'Filename', type: 'text', default: 'download.bin' },
  ],
  article: [
    {
      heading: 'Building a header, or reading one',
      body: 'In build mode the tool takes a disposition type and a filename and writes a complete response header: an ASCII fallback such as filename="resume 2025.pdf" plus an RFC 5987 filename*=UTF-8\'\'… parameter carrying the percent-encoded bytes, so accented and non-Latin names survive the trip. In parse mode you paste raw header lines and get a table of the disposition type, every parameter and its value, with problems flagged as separate rows.',
    },
    {
      heading: 'Why filename* exists alongside filename',
      body: 'A download called résumé.pdf sent with only filename= gets mangled by older clients and can be rejected outright by modern ones. Emitting both parameters is the standard remedy; the ASCII fallback is produced automatically by stripping diacritics, replacing unencodable characters with underscores and dropping quotes, backslashes and semicolons.',
    },
    {
      heading: 'What the parser flags',
      body: 'Each parsed line warns about uncommon disposition types, repeated filename parameters and filenames containing backslashes or forward slashes — the path-traversal shape a server must sanitize before trusting it. Text that is not a valid header becomes an “Invalid header” row instead of throwing, so a whole paste still reports.',
    },
    {
      heading: 'Header text only, nothing on the wire',
      body: 'The tool shapes or inspects header strings and never issues an HTTP request or attaches a response, so it cannot by itself trigger a download. Everything is evaluated locally; the filenames you type and the headers you paste stay in the page.',
    },
  ],
  examples: [
    {
      title: 'Build a Unicode download header',
      options: { mode: 'build', disposition: 'attachment', filename: 'résumé 2025.pdf' },
    },
    {
      title: 'Parse a response header',
      input: 'attachment; filename="report.pdf"; filename*=UTF-8\'\'report%20final.pdf',
    },
    {
      title: 'Inline display header',
      options: { mode: 'build', disposition: 'inline', filename: 'invoice-2026.pdf' },
    },
  ],
  faq: [
    {
      q: 'Why does the output include filename*?',
      a: 'filename* uses RFC 5987 encoding and safely carries Unicode filenames. A quoted ASCII fallback is included for older clients.',
    },
    {
      q: 'Does this set a browser download?',
      a: 'No. It only creates or parses header text locally and never sends a response.',
    },
    {
      q: 'Can a filename be trusted as a path?',
      a: 'No. Header filenames are client hints. Servers should sanitize names, prevent path traversal, and avoid deriving authorization from them.',
    },
  ],
  related: ['mime-lookup', 'url-encode', 'set-cookie'],
  status: 'stable',
};
