/**
 * Editorial content for the compressed-file-inspector tool page.
 *
 * Kept out of ``compressed-file-inspector.meta.ts`` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Which formats are supported?',
      a: 'gzip (.gz), zlib (RFC 1950), and zstd frames, plus ZIP local-file and central-directory records. Unrecognised containers are reported by their first bytes instead of being guessed.',
    },
    {
      q: 'Is the file decompressed?',
      a: 'No. Only the container headers are parsed so multi-gigabyte files stay fast; the tool never inflates or executes the contents.',
    },
    {
      q: 'Why does a member name look odd?',
      a: 'Names are shown as stored. ZIP archives from older tools may use CP437 or GBK bytes, which the Unicode names are not always able to represent verbatim.',
    },
  ],
} as const;