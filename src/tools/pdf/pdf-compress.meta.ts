import type { ToolMeta } from '@/lib/types';
import { fflateCredit, pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-compress',
  name: 'Compress PDF',
  category: 'pdf',
  summary:
    'Shrink a PDF by re-encoding its images and rebuilding the file, with before/after size.',
  description:
    'Reduce the size of a PDF locally in your browser: embedded pictures are downsampled and re-encoded, unused objects are removed and the file is rewritten in one compact revision. The original is returned unchanged whenever compression would not help.',
  keywords: ['pdf', 'compress', 'shrink', 'optimize', 'reduce size', 'downsample', 'images'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'preset',
      label: 'Quality preset',
      type: 'select',
      default: 'balanced',
      help: 'How hard to push image compression. Light only rebuilds the file.',
      choices: [
        { value: 'light', label: 'Light — lossless rebuild, images untouched' },
        { value: 'balanced', label: 'Balanced — downsample pictures over 1600 px to 75% JPEG' },
        { value: 'strong', label: 'Strong — downsample pictures over 1100 px to 55% JPEG' },
        { value: 'custom', label: 'Custom — choose the limits below' },
      ],
    },
    {
      key: 'maxEdge',
      label: 'Longest image side (px)',
      type: 'number',
      default: 1600,
      min: 200,
      max: 6000,
      showWhen: { key: 'preset', value: 'custom' },
    },
    {
      key: 'quality',
      label: 'JPEG quality (%)',
      type: 'range',
      default: 75,
      min: 1,
      max: 100,
      showWhen: { key: 'preset', value: 'custom' },
    },
    { key: 'stripMetadata', label: 'Remove document metadata', type: 'boolean', default: false },
    { key: 'outputName', label: 'Output file name', type: 'text', default: 'compressed.pdf' },
  ],
  examples: [
    { title: 'Compress a PDF (balanced)' },
    { title: 'Strong compression', options: { preset: 'strong' } },
  ],
  faq: [
    {
      q: 'Is my PDF uploaded anywhere?',
      a: 'No. The whole process runs in a Web Worker on your device; the file never leaves your browser.',
    },
    {
      q: 'What if the result is bigger?',
      a: 'You get the original file back untouched and a note saying compression would not have helped.',
    },
    {
      q: 'Why did the size barely change?',
      a: 'pdf-lib can rebuild streams and re-encode raster pictures, but it cannot re-compress text or vector artwork, and it cannot transcode JPEG 2000, CCITT fax or transparency masks.',
    },
  ],
  related: [  "pdf-to-images",
  "pdf-merge",
  "image-compress"],
  credits: [pdfCredit, fflateCredit],
  status: 'beta',
};
