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
  faq: [
    {
      q: 'What is the difference between key and code?',
      a: 'The code is the physical position of the key — KeyA is always the key labelled A, whatever your layout says. The key is the character that position produces, so it follows your keyboard layout and the Shift key. The panel shows both, which is how you spot a layout that does not match the keycaps.',
    },
    {
      q: 'My keyboard failed the rollover test — is it broken?',
      a: 'Not necessarily. The browser only reports what the operating system hands it, so a failed combination can come from the keyboard hardware, the operating system’s key filter or the browser — not from this page. Try the same combination on another machine, or with the OS key filter turned off, before blaming the hardware.',
    },
    {
      q: 'Does this page record what I type?',
      a: 'No. The key events are read in the tab and used to draw the screen; nothing is stored, logged, or sent anywhere. The page keeps working with no connection at all.',
    },
    {
      q: 'Why does the light stay on for a key I already let go of?',
      a: 'So you can still read the value of a key you have just released. The last key stays on screen for a couple of seconds; tick “Pin the last key” to keep it until you press another one.',
    },
    {
      q: 'Can I test a combination of my own?',
      a: 'Yes. Type it into the custom box — for example ctrl + shift + t — and press Use. Avoid combinations the browser reserves (Ctrl+T, Ctrl+W, Ctrl+Shift+N and friends), because the browser acts on them before the page sees them.',
    },
    {
      q: 'What does “Down together” mean in the report?',
      a: 'It is the set of keys that were physically held at the same moment during the attempt. A pass means every key of the combination was in that set; a fail names the key that never joined the others.',
    },
    {
      q: 'Does it work with non-US layouts?',
      a: 'Yes. The lights follow the physical position (the code), so they are right on any layout. The readout shows both the character your layout produced and the US character for the same physical key.',
    },
  ],
  related: ['unicode-lookup', 'whitespace-visualizer', 'morse-code'],
  status: 'beta',
};
