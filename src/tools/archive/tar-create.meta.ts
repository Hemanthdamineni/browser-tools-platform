import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'tar-create',
  name: 'Create TAR Archive',
  category: 'archive',
  summary: 'Bundle files into a TAR (optionally gzipped .tar.gz) archive.',
  description:
    'Create a ustar-format TAR archive from one or more files. Optionally gzip it to a .tar.gz for smaller downloads.',
  keywords: ['tar', 'tar.gz', 'tgz', 'archive', 'bundle'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  multiple: true,
  options: [
    { key: 'tarName', label: 'Archive name', type: 'text', default: 'archive.tar' },
    { key: 'gzip', label: 'Gzip (.tar.gz)', type: 'boolean', default: false },
  ],
  article: [
    {
      heading: 'What comes out of the packer',
      body: 'Drop one or more files and this tool writes a POSIX ustar TAR stream: a 512-byte header per file, the file bytes, zero padding to a block boundary, and two empty blocks at the end. You get a .tar download served as application/x-tar, with stats for file count and input and output bytes.',
    },
    {
      heading: 'Adding gzip on top',
      body: 'The Gzip switch sends the finished TAR through fflate and rewrites the download name: archive.tar becomes archive.tar.gz, and any other name gets its extension replaced. Compression pays off for text and logs and barely helps with files that are already compressed, such as JPEGs.',
    },
    {
      heading: 'A concrete reason to build a tarball',
      body: 'Reach for it when a Linux server, a build script or a colleague expects "tar xf" input, or when a directory tree should travel as one file instead of a folder of loose documents. The Archive name option sets the downloaded filename and, with gzip, the extension.',
    },
    {
      heading: 'Limits worth knowing',
      body: 'Entry names are clipped to 99 bytes, so deep paths are truncated, and only regular files are stored — empty directories get no entry. Paths that are absolute, carry a drive letter, or contain empty, dot or traversal segments are refused, so no entry can escape the archive root.',
    },
    {
      heading: 'Built in your browser',
      body: 'Every byte is assembled on your device; no file is uploaded and no request is made. You can archive private documents on a plane, and it keeps working with the network off.',
    },
  ],
  examples: [
    { title: 'Create a TAR archive' },
    { title: 'Create a gzipped archive', options: { gzip: true, tarName: 'bundle.tar' } },
    { title: 'Name the archive', options: { tarName: 'project-source.tar' } },
  ],
  faq: [
    {
      q: 'What is the difference between .tar and .tar.gz?',
      a: 'A .tar file is the archive itself: headers plus the raw file bytes with no compression. Tick Gzip and the whole archive is compressed with gzip, giving a .tar.gz that is normally much smaller for text but barely smaller for files that are already compressed, such as JPEGs.',
    },
    {
      q: 'Why is a very long path truncated?',
      a: 'The ustar format stores entry names in a 100-byte field, so a name is clipped to 99 bytes plus a terminator. Deeply nested paths can therefore lose their tail; flatten the structure before archiving, or use a pax or zip tool when long paths must be preserved exactly.',
    },
    {
      q: 'Can the archive contain a path that escapes its root?',
      a: 'No. Absolute paths, drive-letter prefixes and names containing empty, dot or traversal segments are refused before anything is written, so no entry can point outside the archive when it is later extracted.',
    },
    {
      q: 'Are my files uploaded anywhere?',
      a: 'No. The archive is built byte by byte in this tab and the file is handed straight back to you for download. Nothing is transmitted, so it works with a completely private file set and with no network connection.',
    },
  ],
  related: ['tar-extract', 'zip-create'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
