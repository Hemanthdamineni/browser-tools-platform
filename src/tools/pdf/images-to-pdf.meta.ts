import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './credits';
export const meta: ToolMeta = {
  id: 'images-to-pdf',
  name: 'Images to PDF',
  category: 'pdf',
  summary: 'Combine image files into a PDF, with one image per page.',
  description:
    'Create a PDF from selected images. Fit pages to each image or place images on A4/Letter paper, processed locally in your browser.',
  keywords: ['images', 'pdf', 'convert', 'jpg', 'png', 'combine'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/png,image/jpeg',
  multiple: true,
  options: [
    {
      key: 'pageSize',
      label: 'Page size',
      type: 'select',
      default: 'fit',
      choices: [
        { value: 'fit', label: 'Fit to image' },
        { value: 'a4', label: 'A4' },
        { value: 'letter', label: 'Letter' },
      ],
    },
    {
      key: 'orientation',
      label: 'Orientation',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Automatic' },
        { value: 'portrait', label: 'Portrait' },
        { value: 'landscape', label: 'Landscape' },
      ],
      showWhen: { key: 'pageSize', value: 'a4' },
    },
    { key: 'margin', label: 'Margin (points)', type: 'number', default: 0, min: 0 },
    {
      key: 'fitMode',
      label: 'Fit image',
      type: 'select',
      default: 'contain',
      choices: [
        { value: 'contain', label: 'Contain' },
        { value: 'cover', label: 'Cover' },
      ],
      showWhen: { key: 'pageSize', value: 'a4' },
    },
  ],
  examples: [
    { title: 'Combine images into a PDF' },
    { title: 'Place each image on an A4 page', options: { pageSize: 'a4' } },
    {
      title: 'Fill A4 pages with a small margin',
      options: { pageSize: 'a4', fitMode: 'cover', margin: 18 },
    },
  ],
  related: ['pdf-to-images', 'pdf-merge'],
  credits: [pdfCredit],
  status: 'stable',
};
