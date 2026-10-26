/**
 * Editorial content for the font-inspector tool page.
 *
 * Kept out of ``font-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What a run returns',
      body: 'One file of up to 32 MB is read with the File API, and the result is a table shaped by the format option. Summary covers family, version, glyph count, units per em, weight and width class, embedding rights and coverage; the other views list each table tag with offset, length and checksum, the name records, coverage by Unicode block, or each finding with its level and detail.',
    },
    {
      heading: 'When choosing a font for a webfont subset',
      body: 'Paste the copy you plan to set and the summary reports how many of those characters the font actually maps and names the ones it does not — the evidence a subsetting or fallback choice needs.',
    },
    {
      heading: 'Options and what they change',
      body: 'format chooses between summary, table directory, name records, Unicode coverage and the findings list, and all five report in the same sentence style. The text field is what gets checked: whitespace-only text skips the check, line breaks are ignored, and only the first 40 missing characters are named before the rest become an n-more note.',
    },
    {
      heading: 'Caps and caveats',
      body: 'The directory stops at 512 tables, names at 400 records and coverage views at 2,000 rows; a collection declaring more than 64 faces has only its first 64 offsets read, with a warning instead of a failure. Coverage counts renderable code points only, capped at 400,000, and the text check reads up to 5,000 distinct characters. WOFF2 glyf and loca arrive Brotli-transformed, so glyphs and names need a browser that exposes a decompressor; otherwise you still get the wrapper header and table directory. No part of the font leaves this page.',
    },
  ],
  faq: [
    {
      q: 'Is my font uploaded anywhere?',
      a: 'No. The file is read with the File API and every table is parsed in this page: there is no upload, no network request and no external library. That matters with fonts because they frequently carry licence text and version metadata that identifies the customer who licensed them.',
    },
    {
      q: 'What can it not read?',
      a: 'WOFF2 table data is Brotli-compressed and glyf/loca are stored transformed, so names, glyphs and coverage are only shown when the browser exposes a Brotli decompressor; otherwise the wrapper header and table directory are still shown in full, with a note. WOFF, TTF, OTF and TTC are read completely. CFF glyph outlines are counted but not decoded, and no rendered preview is produced.',
    },
    {
      q: 'What does the embedding row mean?',
      a: 'It decodes the OS/2 fsType bits, the field a foundry uses to grant or refuse embedding: installable, restricted (no embedding), preview and print only, editable, plus the no-subsetting and bitmap-only flags. It is metadata, not legal advice, and the licence name records (name ID 13 and 14) are listed with it so you can read the real terms.',
    },
    {
      q: 'Why might the code point count differ from another font tool?',
      a: 'Coverage counts characters a renderer can actually set. Codes that map to glyph 0 (no glyph) are not counted, and neither are the NUL and carriage-return mappings some fonts carry. fontconfig drops the same control characters, so the totals usually agree exactly; a tool that counts raw cmap entries can report a couple more.',
    },
    {
      q: 'Why do checksums fail on fonts that work fine?',
      a: 'Plenty of shipping fonts, especially older hinted ones, were written with stale table checksums and their head.checkSumAdjustment no longer matches. The inspector reports that as a warning rather than an error, because the font is still valid for rendering; it only becomes an error when a table points outside the file, which means the file is truncated.',
    },
  ],
} as const;
