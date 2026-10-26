/**
 * Editorial content for the zip-create tool page.
 *
 * Kept out of ``zip-create.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Bundling files into one ZIP archive',
      body: 'This tool compresses one or more dropped files into a single ZIP archive using the fflate library. Each file is read fully into memory as a Uint8Array and stored under its own entry name, and the archive comes back as an application/zip blob plus stats for file count, input bytes, output bytes and ratio.',
    },
    {
      heading: 'When reaching for a ZIP creator makes sense',
      body: 'Reach for it when several files must travel as one unit: email attachments, a photo set, a config folder, or a batch you want smaller before transferring. Any file your browser can read works, and the finished archive opens in any standard unzip tool.',
    },
    {
      heading: 'The options that change the result',
      body: 'The compression level runs from 0, storing entries uncompressed and fastest, to 9 for the smallest output at the cost of time; 6 is the default middle ground. Flatten stores each file under its basename alone, dropping folders and letting same-named files collide.',
    },
    {
      heading: 'How entry paths are validated',
      body: 'Entry names must be clean relative paths. Absolute paths, drive-letter prefixes such as C:, and names with empty, dot or traversal segments like .. are rejected, since an entry must never escape the archive root on extraction. With flatten off, the browser-supplied folder path is preserved.',
    },
    {
      heading: 'Nothing is sent anywhere',
      body: 'Compression runs on your device inside this tab with the bundled fflate library. No file bytes are uploaded and nothing leaves your browser, so sensitive documents can be zipped freely and the tool keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'Why did my upload fail with an "Invalid archive path" error?',
      a: 'Entry names must be relative and free of empty, dot or traversal segments. Absolute paths, drive-letter prefixes like C:, or names containing .. are rejected so the archive can never contain entries that would escape its root on extraction.',
    },
    {
      q: 'Does flattening lose the folder structure?',
      a: 'When the flatten option is on, each file is stored under only its basename, so all folders are dropped and files sharing a name collide in the archive. Leave flatten off to preserve the original webkitRelativePath folder layout.',
    },
    {
      q: 'Is the archive compatible with other tools?',
      a: 'Yes. It is a standard PKZIP/deflate archive produced by the fflate library, so Windows Explorer, macOS Archive Utility, Linux unzip and any other ZIP reader can open it. Nothing about the format is specific to this app.',
    },
  ],
} as const;
