/**
 * Editorial content for the gzip tool page.
 *
 * Kept out of ``gzip.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does and the file formats',
      body: 'This tool compresses a single file into the gzip format (a .gz archive) or decompresses a .gz file back to its original bytes. The output is always one file: in compress mode the file name gains a .gz suffix, and in decompress mode the .gz extension is stripped so you get the original name back. The magic bytes 1F 8B identify a gzip stream, which is how the automatic mode picks a direction for you.',
    },
    {
      heading: 'When to use it',
      body: 'Use it before sending a log, data export or static asset over a slow link, or when you need a smaller file to store or attach. Use decompress when a tool or editor handed you a .gz you cannot read directly — for example a compressed CSV you need to inspect. If you are unsure of the direction, leave the mode on auto and it sniffs the header for you.',
    },
    {
      heading: 'The options that matter',
      body: 'The compression level runs from 0 (no compression, fastest) to 9 (maximum compression, slowest) and only applies in compress mode; the default 6 is a sensible trade-off. The mode select forces the direction or keeps auto-detect. In auto mode a file that already has a .gz name is still compressed, appending another .gz only when the bytes do not already look like a gzip stream.',
    },
    {
      heading: 'Limits and error cases',
      body: 'Decompression fails loudly when the bytes carry the gzip magic but are not a valid stream, and a file that is plain text with no gzip header is refused in explicit decompress mode. The tool only processes the first selected file, and each run returns a single output. Compression and decompression happen in memory, so very large files consume an amount of RAM comparable to their size.',
    },
    {
      heading: 'Privacy',
      body: 'Everything runs in your browser on your device. The file you pick is read into memory locally, compressed or decompressed there, and is never uploaded to any server. This tool makes no network requests at all.',
    },
  ],
  faq: [
    {
      q: 'Why does a plain text file refuse to decompress?',
      a: 'The gzip magic bytes 1F 8B identify a stream. In explicit decompress mode, a file whose bytes do not start with that signature is refused rather than passed through, because silently treating non-gzip data as compressed would corrupt it.',
    },
    {
      q: 'Is level 9 always better?',
      a: 'No. Higher levels shrink the output more slowly and can even be larger for tiny or already-incompressible files. The default level 6 is a good speed-versus-size trade-off for most files.',
    },
    {
      q: 'Does compressing in the browser upload anything?',
      a: 'No. The file is read into memory locally and compressed or decompressed in this tab. Nothing is sent to a server, and a very large file consumes roughly its size in RAM for the duration of the run.',
    },
  ],
} as const;
