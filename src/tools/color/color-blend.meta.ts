import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'color-blend',
  name: 'Color Blender',
  category: 'color',
  summary: 'Mix two colors in RGB or HSL space with a 0-100% blend ratio.',
  description:
    'Pick two colors and a blend ratio to see the midpoint color in RGB or HSL space. HSL blending follows the shorter path around the hue wheel, so red-to-blue passes through magenta, not green.',
  keywords: [
    'color blend',
    'color mix',
    'mix colors',
    'interpolate color',
    'lerp color',
    'midpoint color',
    'gradient midpoint',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'second', label: 'Second color', type: 'text', default: '#ffffff' },
    {
      key: 'ratio',
      label: 'Blend ratio (%)',
      help: '0% is all the first color, 100% is all the second.',
      type: 'range',
      default: 50,
      min: 0,
      max: 100,
      step: 1,
    },
    {
      key: 'space',
      label: 'Blend space',
      type: 'select',
      default: 'rgb',
      choices: [
        { value: 'rgb', label: 'RGB (per channel)' },
        { value: 'hsl', label: 'HSL (hue, saturation, lightness)' },
      ],
    },
  ],
  article: [
    {
      heading: 'What it produces',
      body: 'This tool takes a first colour from the input and a second colour from the options, and mixes them by a 0-100 percent ratio to show the midpoint colour plus the actual RGB values it computed. The ratio is the fraction of the second colour: 0% is all the first colour, 100% is all the second, and 50% is a true halfway blend. The result is shown as a hex value that you can copy.',
    },
    {
      heading: 'RGB versus HSL blending',
      body: 'In RGB space each channel is interpolated linearly, which is predictable but can look muddy for vivid colours — mixing pure red and pure blue gives a dark purple. In HSL space the hue walks the shorter way around the colour wheel, so red to blue passes through magenta and the midpoint is far brighter. Choose HSL when you want a colour that feels midway between two hues rather than a weighted average of channels.',
    },
    {
      heading: 'What you can type',
      body: 'Either side of the blend accepts a hex colour such as #3b82f6, an rgba() or hsla() functional notation, or any of the 148 CSS named colours. The parser reads the first colour from the input text and the second from the second option, so you can paste one and type or pick the other. A bad value is reported with a hint listing the accepted forms.',
    },
    {
      heading: 'Limits and round-off',
      body: 'Blending always returns an opaque RGB result, so alpha information in the inputs is ignored. The output is rounded to whole bytes, which is fine for screen colours but not for a precise colour-management pipeline. HSL blending picks the shorter hue arc, so the apparent direction of a blend can surprise you when two hues are far apart on the wheel.',
    },
    {
      heading: 'Nothing leaves your device',
      body: 'Both colours are parsed and blended locally in this tab. There is no upload and no network request, so you can blend colours for confidential brand work without it ever reaching a server.',
    },
  ],
  examples: [
    { title: 'Black to white', input: '#000000' },
    { title: 'Halfway to blue', input: '#ff0000', options: { second: '#0000ff' } },
    { title: 'HSL blend', input: 'red', options: { second: 'blue', space: 'hsl' } },
  ],
  faq: [
    {
      q: 'Why does RGB blending look dark in the middle?',
      a: 'RGB blends each channel linearly, which can produce muddy midpoints. HSL blending moves around the hue wheel instead and often looks more natural for vivid colors.',
    },
    {
      q: 'What does a 0% or 100% ratio do?',
      a: '0% returns the first colour unchanged and 100% returns the second colour unchanged, so those two values are a quick way to confirm which side of the blend each colour is on.',
    },
    {
      q: 'Can I blend two colours I typed as names?',
      a: 'Yes. The parser accepts the 148 CSS named colours on both sides, so input: "tomato" with second: "teal" works exactly like hex codes.',
    },
  ],
  related: ['color-palette', 'gradient-css', 'color-convert'],
  status: 'stable',
};
