import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'warc-archive-inspector',
  name: 'WARC Archive Inspector',
  category: 'archive',
  summary:
    'Inspect WARC web archives: records, block digests, target URIs, lengths and damage.',
  description:
    'Open a WARC or WARC.GZ web archive and see what it captured: the archive version and writer software from the file header, then every record with its type (warcinfo, request, response, revisit, resource, metadata, conversion, continuation), its target URI, capture date, IP, content type and byte length. Each record is located by walking the header blocks and their declared Content-Length, so a record whose length disagrees with the bytes on disk — the usual cause of a corrupt archive — is reported at the exact offset where parsing lost sync. For response records the embedded HTTP status line and headers are read so you can see what was actually returned. Supports gzip-compressed archives, recomputes the WARC-Block-Digest of every record that declares one and names any record whose bytes no longer match their digest, and flags duplicate captures of the same URI. Everything is parsed on-device.',
  keywords: [
    'warc',
    'warc.gz',
    'web archive',
    'wayback',
    'harvest',
    'crawl',
    'warcinfo',
    'revisit',
    'web archiving',
    'archive inspector',
    'common crawl',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.warc,.warc.gz,.warcgz,application/warc,application/gzip',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'records', label: 'Records' },
        { value: 'uris', label: 'Target URIs' },
        { value: 'responses', label: 'HTTP responses' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'maxRows',
      label: 'Max rows listed',
      type: 'number',
      default: 100,
      min: 0,
      max: 20000,
    },
  ],
  examples: [{ title: 'Check whether a WARC archive is intact' }],
  related: ['compressed-file-inspector', 'feed-inspector', 'binary-file-signature', 'file-metadata'],
  status: 'stable',
};