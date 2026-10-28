import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'torrent-file-inspector',
  name: 'Torrent File Inspector',
  category: 'converters',
  summary:
    'Read a .torrent: info-hash, magnet link, file list, piece size and tracker, decoded on-device.',
  description:
    'Open a BitTorrent metainfo file and see exactly what it describes: the announce and web-seed trackers, the torrent name, the piece length and piece count with the expected boundaries, the total size, and every file inside a multi-file torrent with its path and length. It computes the SHA-1 info-hash from the raw bencoded info dictionary — the same value a client derives — and shows it both as 40-character hex and as the 32-character base32 form used in magnet links, with a ready-to-copy magnet URI. It also validates the structure: piece hashes must be whole multiples of 20 bytes, lengths must be non-negative integers, and every required key must be present, so a malformed or truncated file is reported with the byte offset where decoding stopped. bencode is decoded on-device; nothing is uploaded and no tracker is contacted.',
  keywords: [
    'torrent',
    'bittorrent',
    'bencode',
    'info hash',
    'magnet link',
    'magnet uri',
    'metainfo',
    'torrent file',
    'piece hash',
    'tracker',
    'decode torrent',
    'torrent inspect',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.torrent,application/x-bittorrent',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'files', label: 'Files' },
        { value: 'pieces', label: 'Pieces' },
        { value: 'trackers', label: 'Trackers' },
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
  examples: [{ title: 'Check a torrent before opening it' }],
  related: ['cbor-decoder', 'base32', 'binary-file-signature', 'hash-identifier'],
  status: 'stable',
};