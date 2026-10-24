import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'id3-tag-reader',
  name: 'MP3 Tag (ID3) Reader',
  category: 'audio',
  summary: 'Read ID3v2 and ID3v1 tags from an MP3: title, artist, album, year, track and cover art.',
  description:
    'Inspect the metadata inside an MP3 file: title, artist, album, album artist, composer, year, track, genre and comments, from both ID3v2 and the older ID3v1 trailer. Shows the tag version, size and every frame when you ask for the raw list, and can pull out embedded cover art as a downloadable image.',
  keywords: [
    'id3',
    'id3v2',
    'id3v1',
    'mp3 tags',
    'read mp3 metadata',
    'album art extractor',
    'music metadata',
    'tag reader',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.mp3,audio/mpeg,audio/mp3',
  options: [
    {
      key: 'raw',
      label: 'List every frame',
      type: 'boolean',
      default: false,
    },
    {
      key: 'extractArtwork',
      label: 'Extract cover art as a file',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [],
  faq: [
    {
      q: 'Which tag versions are supported?',
      a: 'ID3v2.2, ID3v2.3 and ID3v2.4 at the start of the file, plus the 128 byte ID3v1 trailer at the end. If both exist, ID3v2 wins because it stores text in Unicode.',
    },
    {
      q: 'How are different text encodings handled?',
      a: 'Each ID3v2 text frame declares its own encoding: ISO-8859-1, UTF-16 with a byte order mark, UTF-16BE or UTF-8. The reader decodes whichever the frame uses, so accented and non-Latin titles come through correctly.',
    },
    {
      q: 'Does it read the whole file?',
      a: 'No. It reads the 10 byte ID3v2 header, then only the tag bytes it declares, and separately the final 128 bytes for ID3v1. A large MP3 is not loaded into memory.',
    },
    {
      q: 'Why is the ID3v1 genre shown as a number?',
      a: 'ID3v1 stores the genre as an index into a fixed 148 entry list. Rather than risk a mistranslated table, the index is reported as-is; ID3v2 stores the genre as text and is shown directly.',
    },
  ],
  related: ['audio-info', 'file-metadata', 'binary-file-signature', 'hex'],
  status: 'stable',
};
