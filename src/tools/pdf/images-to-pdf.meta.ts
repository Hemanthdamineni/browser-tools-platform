import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
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
    { key: 'margin', label: 'Margin (points)', type: 'number', default: 0, min: 0, max: 200 },
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
  article: [
    {
      heading: 'Pages and layout',
      body: 'Choose PNG or JPEG files and each one becomes a page, in the order selected. With Fit to image the page adopts the picture dimensions, so nothing is cropped or padded. A4 or Letter instead places the image on fixed paper, centred, with Automatic orientation turning wide pictures sideways.',
    },
    {
      heading: 'Contain versus cover',
      body: 'On fixed paper, Contain scales the image until it fits inside the printable area and leaves margins. Cover scales it until it fills the area, cropping the overflow. The margin option adds a point-based border on every side, where 72 points equal one inch.',
    },
    {
      heading: 'When to use it',
      body: 'Ideal for turning a phone full of scanned receipts or photographed pages into one shareable document, and for attaching a batch of screenshots to a report without a desktop publishing program.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Only PNG and JPEG decode, and any other file raises an error naming it. The result is a single images.pdf with no text layer, because every page is a rendered image. Building happens in your browser and no file is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Can I mix PNG and JPEG files?',
      a: 'Yes. Pick any number of PNG or JPEG images and they are added in the order shown, one image per page.',
    },
    {
      q: 'What page sizes are available?',
      a: 'Fit to image makes the page match each picture. A4 and Letter place the image on fixed paper, centred, with an optional margin in points where 72 points equal one inch.',
    },
    {
      q: 'Will the PDF contain selectable text?',
      a: 'No. Every page is a rendered image, so there is no text layer to search or copy.',
    },
  ],
  related: ['pdf-to-images', 'pdf-merge'],
  credits: [pdfCredit],
  status: 'stable',
};
