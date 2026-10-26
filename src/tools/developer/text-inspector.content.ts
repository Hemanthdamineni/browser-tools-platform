/**
 * Editorial content for the text-inspector tool page.
 *
 * Kept out of ``text-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reports',
      body: 'Pasted text comes back as two sections: a summary counting code points, non-ASCII code points, the leading BOM, and line endings split into CRLF, LF and CR, plus a findings table with line, column, hex code point, category, name and the character itself. Flagged categories are control characters, format and invisible characters, unusual spaces, and combining marks.',
    },
    {
      heading: 'When to use it',
      body: 'Paste a snippet that misbehaves — invisible characters carried in from a web page, or line endings that wreck a diff — and the table names the exact line and column of each suspect code point so you can delete or escape just those.',
    },
    {
      heading: 'Options that change the result',
      body: "showAllNonAscii widens reporting to every code point above U+007F instead of only the flagged categories, which is what you want when checking whether a string is pure ASCII. maxFindings caps the table at 10 to 5000 rows; the summary's reported-finding count stays truthful and the notes state how many rows were dropped.",
    },
    {
      heading: 'Edge cases worth knowing',
      body: 'The input is already a JavaScript string, so the original byte encoding is gone before the tool runs — it sees a leading BOM character but cannot tell UTF-8 from UTF-16. The BOM is deliberately kept out of the findings table and shown only in the summary, and carriage returns are counted apart from CRLF pairs.',
    },
    {
      heading: 'Privacy',
      body: 'All scanning happens on your device against the string you paste. Nothing is uploaded and no options are sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'Does this detect the original file encoding?',
      a: 'No. The tool receives a JavaScript string after the browser has already decoded its source. It can identify a leading Unicode BOM character and inspect code points, but it cannot reliably recover the original byte encoding from pasted text.',
    },
    {
      q: 'Why are some characters marked as format characters?',
      a: 'Unicode format characters can affect text direction, joining, or display while remaining invisible, such as zero-width joiners and bidirectional controls. Some are legitimate in language text; inspect context before removing them.',
    },
    {
      q: 'Does this modify or upload my text?',
      a: 'No. It reports character and newline findings without changing the input or sending network requests.',
    },
  ],
} as const;
