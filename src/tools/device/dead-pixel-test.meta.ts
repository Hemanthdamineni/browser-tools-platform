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
      max: 60000,
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
  article: [
    {
      heading: 'What the test does',
      body: 'The panel fills the screen with one flat colour at a time so nothing else competes with a faulty pixel. It sweeps the eight saturated colours — black, white, red, green, blue, cyan, magenta and yellow — and then a nine-step grey ramp from black to white. Each colour is drawn by your own browser on your own display.',
    },
    {
      heading: 'How to run it',
      body: 'Press “Start fullscreen” to enter fullscreen, then use the right and left arrow keys to step forward and back through the sweep, or let the auto-cycle advance for you. Space toggles the auto-cycle and Escape leaves fullscreen. Clean the screen first, and view it from straight on — a dead pixel looks the same from every angle, while dust and reflections do not.',
    },
    {
      heading: 'Reading the result',
      body: 'A dead pixel stays black on every colour, including white. A stuck sub-pixel stays lit in red, green or blue, so it is most obvious on a grey step that should be neutral. Flag any screen you are unsure about and the panel builds a short report of the sweep when you leave fullscreen.',
    },
    {
      heading: 'Limits and privacy',
      body: 'A browser cannot inspect your panel’s hardware, so the report records only what you saw, not what the display did. Fullscreen is requested on your click or key press, never on load. Nothing is uploaded and nothing is stored: the colours are local CSS values and the report lives only in this tab.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between a dead and a stuck pixel?',
      a: 'A dead pixel never lights up — it stays black on every colour. A stuck sub-pixel stays lit in one of its three colours (red, green or blue), so it shows up on solid colours that should hide it. A grey ramp is the fastest way to catch a stuck sub-pixel.',
    },
    {
      q: 'How do I leave fullscreen?',
      a: 'Press Escape — the same key your browser uses to leave fullscreen. The panel also shows this hint on screen. If a dead pixel test has you staring at a blank colour, Escape is always the way out.',
    },
    {
      q: 'My screen has a speck — is it a dead pixel?',
      a: 'Not necessarily. Move the same solid colour to another monitor, or open the panel again on a fresh background. Dust on the glass and image retention both masquerade as dead pixels. A real dead pixel stays the same colour on every screen and every angle.',
    },
  ],
  related: ['keyboard-tester', 'screen-recorder', 'mic-test'],
  status: 'stable',
};
