import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'dead-pixel-test',
  name: 'Dead Pixel Test',
  category: 'device',
  summary: 'Full-screen solid colors to identify dead, stuck, or hot pixels on your display.',
  description:
    'Cycle through solid colors (white, black, red, green, blue) in fullscreen mode to visually inspect your display for dead pixels (always off), stuck pixels (always on one color), or hot pixels (always bright white). Use keyboard arrows or on-screen buttons to navigate. Press Escape or click the exit button to leave fullscreen.',
  keywords: [
    'dead',
    'pixel',
    'stuck',
    'pixel',
    'hot',
    'pixel',
    'display',
    'screen',
    'test',
    'fullscreen',
    'lcd',
    'oled',
    'monitor',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'dead-pixel-test',
  options: [
    {
      key: 'autoCycle',
      label: 'Auto-cycle Interval (s)',
      type: 'number',
      default: 0,
      min: 0,
      max: 60,
      step: 1,
      help: 'Automatically cycle colors every N seconds. 0 = manual only.',
    },
  ],
  faq: [
    {
      q: 'How do I enter fullscreen?',
      a: 'Click the "Enter Fullscreen" button in the panel. You can also press F11 in most browsers.',
    },
    {
      q: 'What colors should I test?',
      a: 'The standard test colors are: White (reveals dead pixels), Black (reveals hot/stuck-white pixels), Red, Green, Blue (reveal stuck sub-pixels). Some panels also include cyan, magenta, yellow for complete sub-pixel testing.',
    },
    {
      q: 'What is a dead pixel vs stuck pixel?',
      a: 'Dead pixel: always black (all sub-pixels off). Stuck pixel: always one color (one sub-pixel stuck on). Hot pixel: always white (all sub-pixels stuck on). Stuck pixels sometimes recover with gentle pressure or flashing colors.',
    },
    {
      q: 'Can this fix stuck pixels?',
      a: 'This tool only helps you *find* them. Some stuck pixels can be fixed by rapidly flashing colors (try the "Flash" button if available) or gentle pressure with a soft cloth. Dead pixels are usually permanent hardware defects.',
    },
    {
      q: 'How do I exit fullscreen?',
      a: 'Press Escape, click the "Exit Fullscreen" button, or press F11 again.',
    },
  ],
  related: ['webcam-test', 'mic-test', 'speaker-test'],
  status: 'stable',
};