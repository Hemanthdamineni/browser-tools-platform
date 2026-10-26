/**
 * Editorial content for the id3-tag-reader tool page.
 *
 * Kept out of ``id3-tag-reader.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reads and where it looks',
      body: 'Metadata lives in an ID3v2 block at the start of an MP3 and an older 128-byte ID3v1 trailer at the end. The tool reads both. When both exist ID3v2 wins, because it stores text as Unicode, and ID3v1 only fills the gaps it left empty.',
    },
    {
      heading: 'The tag versions it understands',
      body: 'ID3v2.2, 2.3 and 2.4 are parsed, along with the ID3v1.1 trailer that carries a track number in its final byte. Each text frame declares its own encoding — ISO-8859-1, UTF-16 with a byte order mark, UTF-16BE or UTF-8 — so accented and non-Latin titles survive intact. Unsynchronisation is reversed and an extended header is skipped.',
    },
    {
      heading: 'Showing the raw frame list',
      body: 'With “List every frame” on, every parsed frame appears by its four-letter identifier (TIT2, TPE1, APIC) with its size and a decoded preview. It is the diagnostic view: frames a tidy summary would hide, such as a second comment or an unusual private frame, become visible here.',
    },
    {
      heading: 'Pulling the artwork out',
      body: 'A cover picture is reported with its MIME type and byte count. Turn on “Extract cover art as a file” and the embedded image is returned as a download whose extension follows the MIME type — a real copy of the stored bytes, not a re-encode.',
    },
    {
      heading: 'How much of the file is loaded',
      body: 'Only the tag bytes are read, so a large MP3 never enters memory. Tags over 16 MB are refused to keep the tool responsive, and a tag that runs past the end of the file is read truncated with a warning. Nothing is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Which tag versions are supported?',
      a: 'ID3v2.2, ID3v2.3 and ID3v2.4 at the start of the file, plus the 128 byte ID3v1 trailer at the end. If both exist, ID3v2 wins because it stores text in Unicode.',
    },
    {
      q: 'How are different text encodings handled?',
      a: 'Each ID3v2 text frame declares its own encoding: ISO-8859-1, UTF-16 with a byte order mark, UTF-16BE or UTF-8. The reader decodes whichever the frame uses, so accented and non-Latin titles come through correctly.',
    },
    {
      q: 'Does it read the whole file?',
      a: 'No. It reads the 10 byte ID3v2 header, then only the tag bytes it declares, and separately the final 128 bytes for ID3v1. A large MP3 is not loaded into memory.',
    },
    {
      q: 'Why is the ID3v1 genre shown as a number?',
      a: 'ID3v1 stores the genre as an index into a fixed 148 entry list. Rather than risk a mistranslated table, the index is reported as-is; ID3v2 stores the genre as text and is shown directly.',
    },
  ],
} as const;
