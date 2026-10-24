import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'x-content-type-options',
  name: 'X-Content-Type-Options Analyzer',
  category: 'web',
  summary: 'Validate X-Content-Type-Options: nosniff.',
  description:
    'Analyze or generate the X-Content-Type-Options response header. Validates the nosniff directive, flags deprecated or non-standard values, and explains how nosniff prevents MIME-type sniffing as recommended by Mozilla and OWASP.',
  keywords: [
    'X-Content-Type-Options',
    'nosniff',
    'MIME sniffing',
    'content type sniffing',
    'security headers',
    'XCTO',
    'browser sniffing protection',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze value' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'value',
      label: 'Value',
      type: 'select',
      default: 'nosniff',
      choices: [
        { value: 'nosniff', label: 'nosniff' },
        { value: 'none', label: '(unsafe — disable) ' },
      ],
    },
  ],
  article: [
    {
      heading: 'Reading and writing the nosniff header',
      body: 'This tool checks or generates an X-Content-Type-Options response header, whose only defined value is nosniff. Analyze mode returns a table with the value, a Valid or Invalid status and a short assessment. Build mode emits the header line X-Content-Type-Options: nosniff, ready for a server or CDN configuration.',
    },
    {
      heading: 'When to check the header',
      body: 'Reach for it when hardening a site or reviewing a scan that reports the header missing or malformed. It is a recommended header for any HTML, CSS or JavaScript a browser reads, and especially for CDNs and static hosts, where a stray upload can otherwise be served as an unexpected type.',
    },
    {
      heading: 'Analyze versus build',
      body: 'Mode switches between analyzing and building. In analyze mode the pasted text is the value under test: nosniff passes, none is flagged as undefined, and anything else is reported as unrecognised. In build mode the value dropdown picks the directive to emit, and choosing none is refused since it would disable the protection.',
    },
    {
      heading: 'Only nosniff is defined',
      body: 'Only nosniff is defined by the specification; other tokens are ignored by browsers and usually signal a legacy or broken configuration, so the tool flags them. The check is case-insensitive and trims whitespace. The header does not replace a correct Content-Type: nosniff only makes the declared type authoritative, so a wrong type stays wrong.',
    },
    {
      heading: 'Where the value is validated',
      body: 'Validation happens entirely in your browser. Nothing you paste is sent anywhere, the tool works offline, and checking a header value never exposes it to a third party.',
    },
  ],
  examples: [
    { title: 'Analyze a nosniff header', input: 'X-Content-Type-Options: nosniff' },
    { title: 'Build the security header', options: { mode: 'build', value: 'nosniff' } },
    {
      title: 'Analyze a non-standard value',
      input: 'nosniff; something',
    },
  ],
  faq: [
    {
      q: 'What does nosniff do?',
      a: 'It tells the browser not to guess a file type from its content; the declared Content-Type is authoritative, reducing drive-by download and injection risk.',
    },
    {
      q: 'Is any other value valid?',
      a: 'Only nosniff is defined. Other values are ignored by browsers and typically indicate a legacy or broken configuration.',
    },
    {
      q: 'When is it required?',
      a: 'It is a recommended security header for any HTML, CSS, or JavaScript delivered to browsers, especially on CDNs and static hosts.',
    },
  ],
  related: ['content-type', 'x-frame-options', 'security-headers'],
  status: 'stable',
};
