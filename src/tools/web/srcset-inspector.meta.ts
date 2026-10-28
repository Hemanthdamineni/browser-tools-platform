import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'srcset-inspector',
  name: 'Srcset Inspector',
  category: 'web',
  summary:
    'Parse and validate srcset and sizes, compute each candidate density and show which image a browser picks.',
  description:
    'Paste the value of an <img> srcset attribute (optionally with its sizes attribute) and see exactly what it means. Each candidate URL is listed with its declared descriptor — a width like 480w or a density like 2x — and its computed effective density: for width descriptors that is the declared width divided by the source size, exactly as the browser derives it. The tool validates against the WHATWG HTML parsing rules and flags the authoring errors that break responsive images: a candidate carrying both a width and a density descriptor, a width of zero or a non-integer width, a density that is not a positive number, an unknown descriptor, an empty srcset, and more. A sizes attribute (media condition pairs such as "(min-width: 800px) 400px, 100vw") is resolved against a viewport width you supply so the computed source size is correct, and the density is then used to show which candidate the browser would select for the chosen device-pixel-ratio. Everything is parsed on-device.',
  keywords: [
    'srcset',
    'sizes',
    'responsive image',
    'responsive images',
    'img',
    'picture',
    'density descriptor',
    'width descriptor',
    'dpr',
    'retina',
    '1x',
    '2x',
    'w descriptor',
    'html validation',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  accept: '*/*',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'candidates', label: 'Candidates' },
        { value: 'selected', label: 'Selected source' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'sizes',
      label: 'sizes attribute',
      type: 'text',
      default: '',
    },
    {
      key: 'viewport',
      label: 'Viewport width (CSS px)',
      type: 'number',
      default: 1280,
      min: 0,
      max: 16384,
    },
    {
      key: 'dpr',
      label: 'Device pixel ratio',
      type: 'number',
      default: 1,
      min: 0.1,
      step: 0.1,
    },
  ],
  examples: [
    { title: 'Retina (2x) images', input: 'hero.jpg 1x, hero@2x.jpg 2x' },
    {
      title: 'Width descriptors + sizes',
      input: 'banner-320.jpg 320w, banner-800.jpg 800w, banner-1600.jpg 1600w',
      options: { sizes: '(min-width: 800px) 800px, 100vw' },
    },
    { title: 'Find a width/density mix error', input: 'a.png 480w, b.png 2x' },
    {
      title: 'Spot the winning candidate at 2x',
      input: 'photo.jpg 1x, photo-hd.jpg 2x',
      options: { format: 'selected', dpr: 2 },
    },
  ],
  related: ['url-parse', 'html-validator', 'data-uri'],
  status: 'stable',
};
