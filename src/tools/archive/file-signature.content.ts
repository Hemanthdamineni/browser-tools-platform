/**
 * Editorial content for the file-signature tool page.
 *
 * Kept out of ``file-signature.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How the leading bytes are read',
      body: 'When you select files, the inspector opens each one in the page and reads only its opening bytes — the header sample you chose, 32, 64 or 256 of them. Those bytes are compared against a fixed table of magic numbers covering PNG, JPEG, GIF, WebP, PDF, ZIP, GZIP, 7-Zip, RIFF containers, executables and several database formats. The table row reports the guessed format, its MIME type, how strong the signature is and the sample in hexadecimal.',
    },
    {
      heading: 'Reading the extension check column',
      body: 'For every file the detected format is compared with the filename extension and with the MIME type the browser reported for the upload. "Extension matches" means the format and suffix agree; "Extension mismatch" normally means the file was renamed, a common outcome for downloads that arrived as .txt or .zip. Signatures with no registered suffix say "Detected; no extension to compare".',
    },
    {
      heading: 'Why a file can come back unknown',
      body: 'Plain text, CSV, JSON and most configuration files carry no fixed header, so nothing can be identified from the opening bytes and the row says Unknown signature. Container formats are deliberately vague: a ZIP header covers DOCX, XLSX, APK and JAR equally, and a RIFF header may be WAV, AVI or WebP, so only the container is named.',
    },
    {
      heading: 'Only a header sample is examined',
      body: 'The bytes are read from the File object inside this tab — they are never uploaded, and the tool makes no network request, so it also works with the browser offline. Because naming a format needs just a few bytes, you can check what a sensitive document really is without exposing its contents to anything.',
    },
  ],
  faq: [
    {
      q: 'Can a file signature prove a file is safe?',
      a: 'No. Signatures can suggest a format and expose some extension mismatches, but they do not validate the full contents or establish that a file is safe. Treat unknown or untrusted files cautiously.',
    },
    {
      q: 'Why might the result say unknown?',
      a: 'The inspector checks known signatures at the start of the file, including a few documented offsets. Many text formats and some container variants have no reliable fixed header and will remain unknown.',
    },
    {
      q: 'Does it read or upload the whole file?',
      a: 'No. It reads only the configured leading sample (at most 256 bytes) in your browser, and makes no network request.',
    },
  ],
} as const;
