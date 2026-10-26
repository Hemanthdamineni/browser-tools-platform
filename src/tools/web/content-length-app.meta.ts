import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-length-app',
  name: 'Content-Length & Body Byte Counter',
  category: 'web',
  summary: 'Compute body byte length and verify content-length.',
  description:
    'Compute the exact UTF-8 byte length of pasted HTTP body content, report the JavaScript string length, flag the character-vs-byte mismatch, and verify a declared Content-Length header value. All computation happens locally.',
  keywords: [
    'Content-Length',
    'content-length',
    'byte length',
    'UTF-8 bytes',
    'UTF8 byte count',
    'body size',
    'content-length mismatch',
    'CRLF',
    'HTTP body bytes',
    'chunked transfer',
    'byte counter',
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
        { value: 'analyze', label: 'Analyze body bytes' },
        { value: 'verify', label: 'Verify a declared value' },
      ],
    },
    { key: 'declared', label: 'Declared Content-Length', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Analyze a JSON body', input: '{"name":"José","emoji":"🎉"}' },
    {
      title: 'Verify a declared value',
      input: 'hello',
      options: { mode: 'verify', declared: '5' },
    },
    {
      title: 'Check an ASCII body',
      input: 'key=value&x=1',
      options: { mode: 'verify', declared: '13' },
    },
  ],
  related: ['http-range', 'url-encode', 'data-size'],
  status: 'stable',
};
