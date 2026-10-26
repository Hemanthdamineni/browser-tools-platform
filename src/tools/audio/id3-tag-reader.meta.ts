import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'id3-tag-reader',
  name: 'MP3 Tag (ID3) Reader',
  category: 'audio',
  summary:
    'Read ID3v2 and ID3v1 tags from an MP3: title, artist, album, year, track and cover art.',
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
  examples: [
    { title: 'Read an MP3 tag', input: '', options: { raw: false, extractArtwork: false } },
    {
      title: 'List every ID3 frame',
      input: '',
      options: { raw: true, extractArtwork: false },
    },
    {
      title: 'Download the cover art',
      input: '',
      options: { raw: false, extractArtwork: true },
    },
  ],
  related: ['audio-info', 'file-metadata', 'binary-file-signature', 'hex'],
  status: 'stable',
};
