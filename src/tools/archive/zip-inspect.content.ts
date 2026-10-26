/**
 * Editorial content for the zip-inspect tool page.
 *
 * Kept out of ``zip-inspect.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reports for every entry',
      body: 'The tool reads the ZIP central directory and lists each file with its uncompressed size, compressed size, compression ratio, CRC-32 and modified date, and totals the bytes and overall ratio so you can see what an archive really saves.',
    },
    {
      heading: 'Reading the directory, not the payload',
      body: 'Only the end-of-central-directory record and the central directory are parsed; the compressed bytes are never inflated. That is why opening a huge archive is instant: the tool needs the table of contents, not the contents themselves.',
    },
    {
      heading: 'When to use it',
      body: 'Before extracting, check whether an archive is unexpectedly large or empty, confirm a member is the right size, or verify a distribution against a published size manifest. The CRC-32 column lets you compare an entry against a checksum your build reported.',
    },
    {
      heading: 'Limits to keep in mind',
      body: 'A standard single-file ZIP with a valid central directory is expected. Multi-part and truncated files are rejected with a clear message, and an entry with a zeroed modification time shows an em dash instead of a date. Local headers are not inspected.',
    },
    {
      heading: 'It stays on your machine',
      body: 'The archive is read into this tab with the browser File API and parsed locally. No file data is uploaded, nothing is stored between visits, and the tool works offline once loaded.',
    },
  ],
  faq: [
    {
      q: 'Does it extract any files?',
      a: 'No. This is inspection only — it lists the directory. Use the Extract tool when you want the members back on disk.',
    },
    {
      q: 'Why is one entry shown as stored?',
      a: 'A file added with no compression keeps the same compressed and uncompressed size, giving a zero ratio. The tool reports the actual ratio, so an already-compressed format such as PNG or JPG often shows a small number.',
    },
    {
      q: 'Can I open a ZIP split across volumes?',
      a: 'No. The parser expects one complete file. A multi-part archive is reported as unsupported rather than misread.',
    },
  ],
} as const;
