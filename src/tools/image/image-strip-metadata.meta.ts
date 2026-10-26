import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-strip-metadata',
  name: 'Strip Image Metadata',
  category: 'image',
  summary: 'Remove EXIF, GPS, XMP and IPTC metadata from JPEG, PNG and WebP images losslessly.',
  description:
    'Delete EXIF, GPS, XMP, IPTC and comment data from JPEG, PNG and WebP images by removing only the metadata segments. The pixel data is copied byte-for-byte and never re-encoded.',
  keywords: [
    'strip exif',
    'remove metadata',
    'gps remover',
    'xmp remover',
    'image privacy',
    'remove exif online',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/jpeg,image/png,image/webp',
  multiple: true,
  options: [
    {
      key: 'keepColorProfile',
      label: 'Keep ICC colour profile',
      type: 'boolean',
      default: true,
      help: 'An ICC profile (JPEG APP2 or PNG iCCP) controls colour, not privacy. Removing it can shift the colours slightly.',
    },
    {
      key: 'removeComments',
      label: 'Remove JPEG comments',
      type: 'boolean',
      default: true,
      help: 'COM segments often hold camera, scanner or software notes.',
    },
  ],
  examples: [
    { title: 'Strip a photo' },
    {
      title: 'Keep the ICC profile, drop comments',
      options: { keepColorProfile: true, removeComments: true },
    },
    {
      title: 'Strip everything including the colour profile',
      options: { keepColorProfile: false, removeComments: true },
    },
  ],
  related: ['image-metadata', 'image-compress', 'image-convert'],
  status: 'beta',
  updated: '2026-10-17',
};
