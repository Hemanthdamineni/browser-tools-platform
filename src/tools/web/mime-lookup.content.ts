/**
 * Editorial content for the mime-lookup tool page.
 *
 * Kept out of ``mime-lookup.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
