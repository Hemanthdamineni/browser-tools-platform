import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-strip-metadata',
  name: 'Strip Image Metadata',
  category: 'image',
  summary: 'Remove EXIF, GPS, XMP and IPTC metadata from JPEG, PNG and WebP images, losslessly.',
  description:
    'Erase camera details, GPS coordinates and editing history without re-encoding a single pixel. JPEG segments, PNG chunks and WebP chunks are cut out byte-for-byte, and the report lists exactly what was removed from every file.',
  keywords: [
    'strip exif',
    'remove exif',
    'remove gps from photo',
    'metadata remover',
    'exif scrubber',
    'xmp remover',
    'remove iptc',
    'clean photo metadata',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'stripExif',
      label: 'Strip EXIF (camera, dates, settings)',
      type: 'boolean',
      default: true,
    },
    { key: 'stripGps', label: 'Strip GPS location', type: 'boolean', default: true },
    {
      key: 'stripXmp',
      label: 'Strip XMP (Adobe, editing history)',
      type: 'boolean',
      default: true,
    },
    {
      key: 'stripIptc',
      label: 'Strip IPTC / Photoshop (JPEG APP13)',
      type: 'boolean',
      default: true,
    },
    { key: 'stripText', label: 'Strip comments & text chunks', type: 'boolean', default: true },
    {
      key: 'stripIcc',
      label: 'Also strip the colour profile (ICC) — may shift colours',
      type: 'boolean',
      default: false,
    },
    {
      key: 'keepOrientation',
      label: 'Keep the orientation tag so rotated photos stay upright',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [{ title: 'Strip metadata from a photo' }],
  faq: [
    {
      q: 'Are my images re-encoded?',
      a: 'No. For JPEG, PNG and WebP the metadata segments are cut out of the original bytes and everything else — including the compressed pixel data — is copied through untouched, so image quality is bit-for-bit identical.',
    },
    {
      q: 'Why does stripping GPS also remove EXIF?',
      a: 'GPS coordinates are stored inside the EXIF block, so removing the location means removing that block. Turn off "Strip GPS location" if you want to keep the rest of the EXIF data.',
    },
    {
      q: 'Which formats are supported?',
      a: 'Lossless stripping is implemented for JPEG, PNG and WebP. Other formats (GIF, AVIF, TIFF, BMP, SVG) are skipped and reported rather than silently re-encoded.',
    },
    {
      q: 'Do my files leave the device?',
      a: 'Never. Everything runs in a Web Worker inside your browser tab, and the tool makes no network requests at all.',
    },
  ],
  related: ['image-metadata', 'image-compress', 'image-convert'],
  status: 'beta',
};
