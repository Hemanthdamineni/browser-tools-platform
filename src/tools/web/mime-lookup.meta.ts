import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mime-lookup',
  name: 'MIME Type Lookup',
  category: 'web',
  summary: 'Look up the MIME type for an extension, or the extensions for a MIME type.',
  description:
    'Type an extension (png, .tar.gz, photo.png) to get its MIME type and whether it is text or binary, or a MIME type to list every extension registered for it. About 180 common types for images, documents, audio, video, archives, code, fonts and data formats.',
  keywords: [
    'mime type',
    'mime lookup',
    'content type',
    'file extension',
    'mimetype',
    'content-type',
    'media type',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'ext-to-mime',
      choices: [
        { value: 'ext-to-mime', label: 'Extension → MIME' },
        { value: 'mime-to-ext', label: 'MIME → extensions' },
      ],
    },
  ],
  examples: [
    { title: 'Extension', input: 'png' },
    { title: 'MIME type', input: 'application/json', options: { mode: 'mime-to-ext' } },
    { title: 'A dotted filename', input: 'photo.png' },
    { title: 'Look up image/png', input: 'image/png', options: { mode: 'mime-to-ext' } },
  ],
  article: [
    {
      heading: 'In both directions',
      body: 'Type an extension and the tool returns the MIME type plus whether the format is treated as text or binary; type a MIME type and it lists every extension registered for it. The table covers about 180 common types across images, documents, audio, video, archives, code, fonts and data formats, so the answer for the format you have is usually a single lookup.',
    },
    {
      heading: 'What counts as an extension',
      body: 'A leading dot is stripped, so "png" and ".png" are the same query, and a dotted filename such as photo.png is answered from its final extension. Case is ignored. A query containing a dot is split on the last one, the same rule Content-Type guessing uses when it has to pick a single type from a name.',
    },
    {
      heading: 'How the mime-to-ext list behaves',
      body: 'When you ask in the other direction, every extension the table registers for that MIME type is returned, not just the first a server might choose. That is the honest answer, because many types legitimately have several — image/x-icon has both ico and cur, and a video type can appear with several extensions depending on its container.',
    },
    {
      heading: 'The compound-extension rule',
      body: 'A name like .tar.gz is matched by its last extension only, so it answers gz and application/gzip rather than resolving the pair. Full compound matching is intentionally not attempted because it is ambiguous — .tar.gz could mean gzip data or a tarball depending on the tool — and the single type is what a Content-Type header carries anyway.',
    },
    {
      heading: 'A local dictionary',
      body: 'The table is embedded in this page and the lookup is a plain map read in the tab. No request is made, so a filename that reveals an internal project structure stays on your machine, and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'How are compound extensions like .tar.gz handled?',
      a: 'Only the last extension is matched (.gz → application/gzip). Full compound-extension matching (.tar.gz) is ambiguous and intentionally not attempted.',
    },
    {
      q: 'What does text or binary mean in the result?',
      a: 'It is a hint from the table about the format’s usual kind — text formats such as JSON, CSS and CSV are shown as text, while images, audio, video and compressed data are shown as binary. It is a guide, not a rule enforced by the tool.',
    },
    {
      q: 'Why does a MIME type return several extensions?',
      a: 'Many types are legitimately served with more than one extension. The tool lists every extension it has registered for that type rather than picking one, so you can choose the convention your project uses.',
    },
  ],
  related: ['data-uri', 'http-status', 'file-metadata'],
  status: 'stable',
};
