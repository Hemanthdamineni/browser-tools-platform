import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'zip-extract',
  name: 'Extract ZIP Archive',
  category: 'archive',
  summary: 'Extract the entries of a ZIP archive as individual download files.',
  description:
    'List and extract ZIP entries locally. Each entry becomes a downloadable file; a small table reports what happened.',
  keywords: ['zip', 'unzip', 'extract', 'archive'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.zip,application/zip',
  options: [
    {
      key: 'filter',
      label: 'Path filter (optional)',
      type: 'text',
      default: '',
      placeholder: 'only extract paths containing…',
    },
  ],
  examples: [
    { title: 'Extract a ZIP' },
    { title: 'Pull out just the log files', options: { filter: '.log' } },
    { title: 'Extract only the assets folder', options: { filter: 'assets/' } },
  ],
  article: [
    {
      heading: 'What it does',
      body: 'You pick one or more .zip files and every entry inside becomes its own downloadable file. The tool reads the central directory, decompresses each entry with fflate, and reports every path with its size and whether it was extracted or skipped.',
    },
    {
      heading: 'Input and output',
      body: 'The input is a ZIP (.zip or application/zip). The output is a set of downloads rather than one re-packed archive, plus a Path, Size and Status table. Separators in entry names become underscores, so folders arrive as a flat list of files rather than rebuilt directories.',
    },
    {
      heading: 'The path filter',
      body: 'The filter is a plain substring match: only paths containing the text you type are extracted, and the rest are marked skipped. Leave it blank for the whole archive, or type a folder or extension to pull out just the part of a large zip you actually want.',
    },
    {
      heading: 'Limits, caveats and privacy',
      body: 'Encrypted archives are refused with a message pointing you at password-aware software, and extraction stops after the first 200 matching entries per file. Paths that are absolute, use drive letters or contain . or .. are never written out. The archive is read on your device with nothing uploaded, and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'Why is an entry marked skipped (limit)?',
      a: 'Extraction stops after the first 200 matching, safe entries so a very large archive does not flood your browser with downloads. Reduce the set by using the path filter, or extract the archive in a tool that writes to disk instead.',
    },
    {
      q: 'Can I extract a password-protected ZIP?',
      a: 'No. The tool inspects the central directory and refuses encrypted archives with a clear error. Use password-aware unzip software for those files.',
    },
    {
      q: 'Why is a file marked skipped but looks fine?',
      a: 'A path is only extracted when it is relative and has no . or .. segments and no drive-letter prefix. Entries with unsafe names, or that do not match the filter, are reported as skipped rather than extracted.',
    },
  ],
  related: ['zip-create', 'zip-inspect'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
