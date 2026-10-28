/**
 * Editorial content for the pdf-structure-inspector tool page.
 *
 * Kept out of ``pdf-structure-inspector.meta.ts`` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does it render or repair the PDF?',
      a: 'Neither. The file is parsed as bytes to read its xref table, trailer and object offsets. Rendering and repair are left to other tools; this one explains what is actually inside the file.',
    },
    {
      q: 'Why does an object offset show as damaged?',
      a: 'Each xref row is checked against the bytes at the recorded offset. If the bytes there do not look like a PDF object, the row is reported with its line and offset — the typical cause of “repair me” dialogs and missing pages.',
    },
    {
      q: 'Is an encrypted PDF opened?',
      a: 'The structure around encryption is inspected, but encrypted object streams are not decrypted. The report states that the file is encrypted so you can unlock it first if you need the contents.',
    },
  ],
} as const;