/**
 * Editorial content for the pdf-merge tool page.
 *
 * Kept out of ``pdf-merge.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Files in, one document out',
      body: 'Select two or more PDFs and every page is copied into a fresh document in selection order: the first file leads, the second follows, and so on. The download is named from the Output file name option, or merged.pdf if that is left blank, and the report gives the file count, page count and byte size.',
    },
    {
      heading: 'Why merging in the browser matters',
      body: 'Contracts, scanned chapters or bank statements you would rather not hand to an unknown combine-PDF site stay in the tab. Each file is parsed with pdf-lib and the merged bytes are assembled there, so a confidential attachment never crosses the network and there is no size or job queue to wait on.',
    },
    {
      heading: 'Encrypted and unreadable files are named',
      body: 'A password-protected file fails with its own filename in the message and the advice to unlock it first, because encryption is never ignored. An empty file or one that is not a PDF is reported the same way, so a partial merge is never produced silently.',
    },
    {
      heading: 'What the bookmark option really does',
      body: 'pdf-lib rewrites pages but not document outlines, so bookmarks from the sources are dropped whether or not Keep bookmarks is ticked. Ticking it does not restore them; it only attaches a note to the result saying the merged file has no outline.',
    },
  ],
  faq: [
    {
      q: 'Are bookmarks preserved?',
      a: 'pdf-lib does not carry document outlines across, so bookmarks from the source files are not retained.',
    },
    {
      q: 'In what order do the pages land?',
      a: 'In the order the files were selected: all pages of the first file, then all pages of the second, and so on. There is no reordering control, so clear the list and reselect if the sequence is wrong.',
    },
    {
      q: 'Can I merge a password-protected PDF?',
      a: 'No. Encryption is not ignored, so a locked file fails with its name in the error. Unlock the document, or export a decrypted copy, and select that instead.',
    },
  ],
} as const;
