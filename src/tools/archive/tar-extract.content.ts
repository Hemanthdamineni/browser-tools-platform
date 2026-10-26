/**
 * Editorial content for the tar-extract tool page.
 *
 * Kept out of ``tar-extract.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What goes in and what comes back out',
      body: 'Drop a .tar, .tar.gz or .tgz file and the extractor walks it in 512-byte ustar blocks. Each regular file it finds becomes its own download, and a table reports every entry with its path, size in bytes and a status of extracted or skipped, so you can see precisely what the archive held.',
    },
    {
      heading: 'When unpacking a tarball in the browser helps',
      body: 'Useful when someone sends a release bundle and you need a single file out of it without opening a shell, or when the machine in front of you has no tar command. Because decompression happens in the tab, there is no upload to wait for and no server-side copy of the archive.',
    },
    {
      heading: 'gzip detection is automatic, and paths are flattened',
      body: 'There is nothing to configure, and you never say whether the archive is compressed: a file starting with the 0x1f 0x8b magic bytes is gunzipped before parsing. Stored folder paths are flattened for the browser, so conf/app/nginx.conf arrives as conf__app__nginx.conf joined by double underscores.',
    },
    {
      heading: 'Skipped entries and malformed archives',
      body: 'Directories, symlinks and anything resembling an absolute or ../ traversal path are listed as skipped rather than written. A header whose recorded size runs past the end of the data is rejected as invalid rather than quietly truncated. Only the 100-character ustar name field is read, so archives using long-name extensions may truncate. Nothing is uploaded; only the bytes you dropped are read, on your device.',
    },
  ],
  faq: [
    {
      q: 'Does it handle .tar.gz and .tgz, or only plain .tar?',
      a: 'All three. If the first two bytes are the gzip magic 0x1f 0x8b the payload is decompressed automatically before the TAR blocks are parsed, and the file extension makes no difference to that check.',
    },
    {
      q: 'Why do the extracted filenames contain double underscores?',
      a: 'A browser download cannot create folders, so stored paths are flattened: every slash in the archive path becomes a double underscore, so docs/readme.txt is saved as docs__readme.txt.',
    },
    {
      q: 'Are directories and symbolic links extracted?',
      a: 'No. Only regular file entries (typeflag 0 or empty) with a safe relative path are written out. Directories, links and unsafe paths still appear in the report table, but with a skipped status.',
    },
    {
      q: 'Is my archive uploaded to a server?',
      a: 'No. The bytes are read and decompressed inside your browser with no network requests, so the file never leaves your device.',
    },
  ],
} as const;
