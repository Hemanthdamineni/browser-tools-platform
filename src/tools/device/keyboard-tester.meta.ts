import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'keyboard-tester',
  name: 'Keyboard Tester',
  category: 'device',
  summary:
    'Watch every key you press light up on screen, read the key and code the browser receives, and test for ghosting.',
  description:
    'An on-screen keyboard that lights up as you type, a live readout of the key, the physical code and the modifier state, and a rollover test that shows whether your keyboard registers every key of a combination at once. Everything happens in this tab — nothing is recorded, stored or sent.',
  keywords: [
    'keyboard',
    'keyboard tester',
    'key tester',
    'key code',
    'keycode',
    'event.code',
    'event.key',
    'ghost',
    'ghosting',
    'rollover',
    'n-key rollover',
    'key events',
    'modifier keys',
    'shift ctrl alt meta',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'keyboard-tester',
  options: [
    {
      key: 'historySize',
      label: 'Rollover attempts kept in the report',
      type: 'number',
      default: 10,
      min: 1,
      max: 50,
      step: 1,
      help: 'How many of the most recent rollover attempts the report shows.',
    },
    {
      key: 'includeTimestamps',
      label: 'Show the time of each attempt',
      type: 'boolean',
      default: true,
      help: 'Adds a column with the clock time the attempt was made.',
    },
    {
      key: 'rolloverWindowMs',
      label: 'Rollover wait window (ms)',
      type: 'number',
      default: 1200,
      min: 200,
      max: 5000,
      step: 100,
      help: 'How long the tester waits for the rest of the combination before it calls the attempt.',
    },
  ],
  examples: [
    { title: 'Check a key I think is dead' },
    { title: 'Test a ctrl + shift + t rollover', options: { rolloverWindowMs: 2000 } },
    {
      title: 'Keep a longer rollover history',
      options: { historySize: 25, includeTimestamps: false },
    },
  ],
  related: ['unicode-lookup', 'whitespace-visualizer', 'morse-code'],
  status: 'beta',
};
