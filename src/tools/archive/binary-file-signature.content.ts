/**
 * Editorial content for the binary-file-signature tool page.
 *
 * Kept out of ``binary-file-signature.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the File Signature Inspector does',
      body: 'For each file it reads the first 512 bytes, compares them with known magic-number signatures, and reports the format, likely MIME type, size and a 16-byte hex preview. Matches cover PNG, JPEG, WebP, PDF, ZIP, GZIP, SQLite, ELF, WASM, MP3 and about twenty more. Extensionless files work too, so a file renamed to .bin is still identified.',
    },
    {
      heading: 'When to use it',
      body: 'Use it when a download arrives with a missing or misleading extension and you need to know what to open it with, or to confirm that an export really produced the format you asked for. Read the result as a hint: leading bytes are strong evidence, but the tool never parses the rest of the file.',
    },
    {
      heading: 'Reading the output columns',
      body: 'The extension check compares the signature with the file name: Matches, Differs, or Unverified when nothing was recognised. DOCX, XLSX and PPTX are all reported as ZIP, since they are ZIP containers; WebP, WAV and AIFF are only confirmed when the four identifying bytes after the RIFF header are present.',
    },
    {
      heading: 'Limits and odd cases',
      body: 'Only the listed formats are detected; anything else reads as Unknown. A truncated file can still match its header. MP3 is spotted by an ID3 tag or a raw frame sync word, and MP4 files take their label from the brand text, so the container may appear as QuickTime movie or MPEG-4 audio or video.',
    },
    {
      heading: 'Nothing leaves your device',
      body: 'Detection runs entirely in your browser. Only 512 bytes per file are read, nothing is uploaded, and the tool works offline, so confidential files stay on the machine.',
    },
  ],
  faq: [
    {
      q: 'What does a signature match prove?',
      a: 'A match suggests a file format based on its leading bytes. It does not validate the whole file, prove the file is safe, or guarantee that the extension matches its contents.',
    },
    {
      q: 'How much of each file is read?',
      a: 'At most the first 512 bytes. Detection is quick even for large files; formats whose identifiers occur later in a file may be reported as unknown.',
    },
    {
      q: 'Why might a ZIP-based document be reported as ZIP?',
      a: 'DOCX, XLSX, PPTX, and other package formats use ZIP containers. Distinguishing them requires inspecting archive entries; this tool reports the container signature only.',
    },
  ],
} as const;
