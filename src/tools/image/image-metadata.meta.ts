import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-metadata',
  name: 'Image Metadata & EXIF Viewer',
  category: 'image',
  summary: 'Inspect image dimensions, file details, and common JPEG EXIF tags.',
  description:
    'Read image dimensions and selected JPEG EXIF or PNG metadata locally without modifying the file. Everything is parsed on your device.',
  keywords: ['image metadata', 'exif viewer', 'photo dimensions', 'jpeg exif', 'png metadata'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  article: [
    {
      heading: 'What it reads',
      body: 'This viewer opens an image and lists what is inside it as a table of tag and value rows: the decoded pixel dimensions, the file name and size, and the metadata blocks it can parse. For JPEGs it reads the EXIF block — camera make and model, orientation, ISO, exposure time, aperture, focal length and the capture date — and for PNGs it reads the IHDR, pHYs, tEXt, zTXt, iTXt and tIME chunks, which include the pixel dimensions, colour type, density and any text a tool embedded.',
    },
    {
      heading: 'Why the metadata matters',
      body: 'EXIF tells you which camera and lens took a shot and when, which is useful when sorting a folder of photos with no meaningful filenames. It is also a privacy concern: a photo can carry GPS coordinates, a serial number and the exact time it was taken. Checking what an image carries before you publish it is the first step, and it is what makes the reduction in size and the removal of those tags worth doing separately.',
    },
    {
      heading: 'Multiple files at once',
      body: 'This tool accepts more than one image. Drop in a batch and each file gets its own block of rows in a single table, labelled with the file name, so you can compare make, model, dimensions and orientation across a whole folder in one pass instead of opening twelve viewers.',
    },
    {
      heading: 'Limits and what is not shown',
      body: 'The reader shows the primary IFD0 tags and the Exif sub-IFD, which covers the common camera fields, but it is not a complete EXIF explorer — MakerNotes, GPS sub-IFDs and thumbnails are not decoded, and only a selected set of PNG chunks is reported. HEIC, RAW and WebP metadata are outside the parsers here, so a file in one of those formats still reports its dimensions but little else. Nothing is modified: the original file is only read.',
    },
    {
      heading: 'Read locally, nothing uploaded',
      body: 'The bytes are decoded in this tab with no network access at all. Images are often private, and a metadata dump can reveal exactly where and when a picture was taken, so nothing is sent anywhere — the parsing happens entirely on your device.',
    },
  ],
  examples: [
    { title: 'Inspect image metadata' },
    { title: 'Compare a batch of JPEGs' },
    { title: 'Check the EXIF orientation before resizing' },
  ],
  faq: [
    {
      q: 'Which tags are shown?',
      a: 'Common camera tags such as Make, Model, Orientation, ISO, exposure, focal length and date, plus PNG text and density chunks.',
    },
    {
      q: 'Is the original file changed?',
      a: 'No. The tool only reads the file you choose.',
    },
    {
      q: 'Can I inspect several images at once?',
      a: 'Yes. Select multiple files and each one gets its own rows in a single table, labelled with the file name.',
    },
  ],
  related: ['image-compress', 'image-palette'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
  updated: '2026-10-17',
};
