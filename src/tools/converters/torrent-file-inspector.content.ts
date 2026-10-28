/**
 * Editorial content for the torrent-file-inspector tool page.
 *
 * Kept out of ``torrent-file-inspector.meta.ts`` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Open a BitTorrent metainfo (.torrent) file and read exactly what it describes: the tracker announce URLs and web seeds, the torrent name, piece length and piece count, the total size, and — for a multi-file torrent — every file path and length. The info-hash is computed from the raw bencoded info dictionary with SHA-1, the same derivation a BitTorrent client performs, and is shown as hex and as the base32 form a magnet link embeds, with a ready-to-copy magnet URI.',
    },
    {
      heading: 'How the info-hash is derived',
      body: 'The info-hash is not a hash of the file. It is the SHA-1 of the bencoded info dictionary verbatim, including its key ordering and every byte of nesting. That is why a torrent re-saved by a tool that rewrites bencoding gets a different hash even when the content is identical: the source of the hash is the exact encoded bytes, so the inspector hashes the decoded dictionary exactly as it appeared in the file rather than a re-serialised version.',
    },
    {
      heading: 'What the inspector validates',
      body: 'A .torrent must be a bencoded dictionary whose info value carries name, piece length, a whole multiple of 20 raw piece-hash bytes, and either a length (single file) or a files list with non-negative lengths. Each check is reported with a reason and the byte offset where decoding stopped, so a truncated or re-combined file fails with a concrete message rather than a generic error.',
    },
    {
      heading: 'Privacy',
      body: 'Everything runs in this tab. The file is decoded locally, the info-hash is computed locally, and no tracker, peer or other host is contacted: unlike opening the torrent in a client, this page makes no network requests at all.',
    },
  ],
  faq: [
    {
      q: 'Is the info-hash a hash of the files being shared?',
      a: 'No. It is the SHA-1 of the torrent\u2019s bencoded info dictionary — the metadata naming the file, its size and its piece boundaries. Two torrents of identical content but different piece sizes or directory names therefore have different hashes.',
    },
    {
      q: 'Why does my magnet link use base32 while the hash column is hex?',
      a: 'The raw info-hash is 20 bytes. The conventional display is 40 hex characters, but BitTorrent\u2019s magnet URIs deliberately use 32 base32 characters because they are unambiguous case-insensitively. The inspector shows both so either form can be copied.',
    },
    {
      q: 'What does "pieces not a whole multiple of 20" mean?',
      a: 'Every piece hash is a SHA-1 digest, which is exactly 20 bytes. The concatenated pieces field must therefore be a multiple of 20; any remainder means the file is truncated or the piece length was misdeclared, and the torrent would fail piece-by-piece verification when downloaded.',
    },
    {
      q: 'Can a tracker or a peer see that I inspected this?',
      a: 'The page is fully client-side and makes no network requests. Opening a .torrent here never announces to a tracker, so nothing learns the file exists unless you choose to use the magnet link in a client.',
    },
  ],
} as const;
