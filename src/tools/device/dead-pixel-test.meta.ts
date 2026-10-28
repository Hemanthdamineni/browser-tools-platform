import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'dead-pixel-test',
  name: 'Dead Pixel Test',
  category: 'device',
  summary:
    'Sweep your screen with solid colours and greys, fullscreen, to spot dead or stuck pixels.',
  description:
    'Fill the screen with a solid colour, fullscreen, and step through a sweep of saturated colours and a grey ramp with the arrow keys — or let it auto-cycle. Dead pixels stay dark and stuck sub-pixels stay one colour no matter what is shown. Everything happens in this tab: the colours are drawn by your own browser and nothing is recorded or uploaded.',
  keywords: [
    'dead pixel',
    'stuck pixel',
    'dead pixel test',
    'pixel test',
    'screen test',
    'LCD test',
    'panel test',
    'solid colour',
    'fullscreen colour',
    'sub-pixel',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'dead-pixel-test',
  options: [
    {
      key: 'intervalMs',
      label: 'Auto-cycle interval',
      type: 'number',
      default: 5000,
      min: 500,
      step: 500,
      help: 'How long each colour stays up while the auto-cycle is running, in milliseconds.',
    },
    {
      key: 'autoCycle',
      label: 'Auto-cycle through the colours',
      type: 'boolean',
      default: false,
      help: 'Advance through the colours automatically, or step them yourself with the arrow keys.',
    },
  ],
  examples: [
    { title: 'Show the full test palette' },
    { title: 'Sweep every 10 seconds', options: { intervalMs: 10000, autoCycle: true } },
    { title: 'Slow manual sweep', options: { intervalMs: 30000, autoCycle: false } },
  ],
  related: ['keyboard-tester', 'screen-recorder', 'mic-test'],
  status: 'stable',
};
