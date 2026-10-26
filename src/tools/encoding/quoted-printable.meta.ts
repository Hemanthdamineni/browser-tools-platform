import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'quoted-printable',
  name: 'Quoted-Printable Encode / Decode',
  category: 'encoding',
  summary: 'Encode or decode MIME quoted-printable (=XX escapes, soft line breaks).',
  description:
    'The email transfer encoding that keeps text mostly readable while escaping bytes that would not survive 7-bit transport. Decode a raw email body, or encode text to it.',
  keywords: ['quoted-printable', 'quoted printable', 'mime', 'email', '=XX', 'rfc 2045'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'decode',
      choices: [
        { value: 'encode', label: 'Text → Quoted-Printable' },
        { value: 'decode', label: 'Quoted-Printable → Text' },
      ],
    },
  ],
  examples: [
    {
      title: 'Decode',
      input: 'J=C3=A9r=C3=B4me paid =E2=82=AC5=\n0 today.',
      options: { mode: 'decode' },
    },
    { title: 'Encode', input: 'Café — €5', options: { mode: 'encode' } },
    {
      title: 'Decode a folded email line',
      input: 'The quick brown fox =\njumps over the lazy dog.',
      options: { mode: 'decode' },
    },
  ],
  related: ['base64', 'url-encode', 'hex'],
  status: 'stable',
};
