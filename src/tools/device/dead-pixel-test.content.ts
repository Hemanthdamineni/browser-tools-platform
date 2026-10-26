/**
 * Editorial content for the dead-pixel-test tool page.
 *
 * Kept out of ``dead-pixel-test.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
