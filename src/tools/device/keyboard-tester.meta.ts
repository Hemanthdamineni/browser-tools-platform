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
  article: [
    {
      heading: 'Watch the keys the browser receives',
      body: 'Press any key and the on-screen keyboard lights its physical position, while a readout shows the key value, the physical code and the modifier state. The report tabulates your recent rollover attempts with the set of keys that were physically held.',
    },
    {
      heading: 'Deciding whether it is the keyboard or the browser',
      body: 'This is the page you open when a key feels dead, when a game refuses to register a three-key combination, or when you suspect the layout does not match the keycaps. Because the lights follow the physical position, a mismatch between the two readouts is a direct clue that the operating system is remapping your keys.',
    },
    {
      heading: 'Options behind the report',
      body: 'Rollover attempts kept in the report (1–50, default 10) sets how much history the table keeps. Show the time of each attempt adds a clock column. Rollover wait window (200–5000 ms, default 1200) is how long the tester waits for the rest of a combination before scoring it — raise it for slow wireless keyboards.',
    },
    {
      heading: 'What a failure does and does not prove',
      body: 'A failed combination can come from the keyboard, an operating system key filter or the browser, because the page only sees what the OS hands it. Avoid combinations the browser reserves — Ctrl+T, Ctrl+W and friends — since the browser acts before the page can. A key you release stays lit for a moment so you can still read its value.',
    },
    {
      heading: 'Keystrokes are not recorded',
      body: 'Key events are read in this tab only to draw the screen and build the on-screen report; nothing is stored, logged or transmitted, and the page works with no connection. Testing a passphrase-shaped combination is safe.',
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
