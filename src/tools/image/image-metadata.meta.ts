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
  examples: [{ title: 'Inspect image metadata' }],
  faq: [
    {
      q: 'Which tags are shown?',
      a: 'Common camera tags such as Make, Model, Orientation, ISO, exposure, focal length and date, plus PNG text and density chunks.',
    },
    {
      q: 'Is the original file changed?',
      a: 'No. The tool only reads the file you choose.',
    },
  ],
  related: ['image-compress', 'image-palette'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
  updated: '2026-10-16',
};
