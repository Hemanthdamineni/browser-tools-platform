import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'http-range',
  name: 'HTTP Range Header Builder & Parser',
  category: 'web',
  summary: 'Build or inspect byte-range request and response headers.',
  description:
    'Generate Range or Content-Range headers, or parse pasted range values with a known representation size. Validates byte positions, suffix ranges, unsatisfiable ranges, and wildcard totals without network access.',
  keywords: [
    'HTTP Range header',
    'Content-Range',
    'Accept-Ranges',
    'byte range',
    'partial content',
    '206 range request',
    '416 range not satisfiable',
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
        { value: 'parse', label: 'Parse range values' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'header',
      label: 'Header type',
      type: 'select',
      default: 'range',
      choices: [
        { value: 'range', label: 'Range request' },
        { value: 'content-range', label: 'Content-Range response' },
        { value: 'accept-ranges', label: 'Accept-Ranges response' },
      ],
    },
    { key: 'start', label: 'Start byte', type: 'number', default: 0, min: 0 },
    { key: 'end', label: 'End byte (inclusive, -1 = open)', type: 'number', default: -1, min: -1 },
    {
      key: 'size',
      label: 'Representation size bytes (0 = unknown)',
      type: 'number',
      default: 0,
      min: 0,
    },
  ],
  examples: [
    { title: 'Parse a request range', input: 'bytes=0-999' },
    {
      title: 'Build a range request',
      options: { mode: 'build', header: 'range', start: 0, end: 1023 },
    },
    {
      title: 'Build a partial response range',
      options: { mode: 'build', header: 'content-range', start: 100, end: 199, size: 1000 },
    },
  ],
  article: [
    {
      heading: 'The three range headers',
      body: 'A client asks for part of a representation with Range, a server answers 206 with Content-Range describing the slice it sent, and Accept-Ranges advertises that the resource supports byte serving at all. Build mode generates any of those values from numeric start, end and size fields, and parse mode reads pasted range values against a known representation size.',
    },
    {
      heading: 'Byte positions are inclusive',
      body: 'The end byte counts as part of the range, so bytes=0-999 asks for one thousand bytes, not nine hundred and ninety-nine. The builder enforces that the end is not before the start, and the parser reports a range that begins at or past the representation size as unsatisfiable.',
    },
    {
      heading: 'Suffix ranges and open ends',
      body: 'A value like bytes=-500 means the final five hundred bytes. When a representation size is supplied, the parser resolves that suffix to a concrete start and end and can warn when the suffix is larger than the whole resource, which simply yields the entire representation.',
    },
    {
      heading: 'No resource is fetched',
      body: 'Every value is parsed and produced as header text inside this page. The tool never requests a URL or inspects a file, so it makes no network calls and keeps your pasted values on your device.',
    },
  ],
  faq: [
    {
      q: 'Are range ends inclusive?',
      a: 'Yes. bytes=0-99 requests the first 100 bytes. Content-Range uses the same inclusive start-end form.',
    },
    {
      q: 'What is a suffix range?',
      a: 'bytes=-500 requests the final 500 bytes. The parser can assess it when a representation size is provided.',
    },
    {
      q: 'Does this download or inspect a resource?',
      a: 'No. It only parses and generates header text locally.',
    },
  ],
  related: ['http-status', 'content-disposition', 'content-length-app'],
  status: 'stable',
};
