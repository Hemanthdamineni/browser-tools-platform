/**
 * Editorial content for the color-contrast tool page.
 *
 * Kept out of ``color-contrast.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Give it two colours, get a verdict',
      body: 'Type the foreground colour into the main box and the background colour into the background option. Both accept six-digit or three-digit hex, an rgb() or rgba() function with plain or percentage channels, or about thirty common CSS colour names. The result table prints the WCAG 2.1 contrast ratio and Pass or Fail for AA and AAA at both normal and large text sizes, plus figures for interface graphics.',
    },
    {
      heading: 'When to reach for it',
      body: 'Run it while picking a palette for a form label, a button or body copy on a card background, to see whether a combination clears 4.5 to 1 before anyone ships it. Because the check is instant, you can nudge a grey a shade darker and watch the ratio jump without leaving the page.',
    },
    {
      heading: 'Reading the APCA line',
      body: 'The final row adds an APCA Lc approximately: a signed number, positive for dark text on a light background and negative the other way, where larger magnitudes mean more perceived contrast. It is a quick perceptual sanity check beside the WCAG ratio, not a replacement, and the interface labels it approximate because it is not the full published algorithm.',
    },
    {
      heading: 'Caveats',
      body: 'The ratio is computed from the two flat colours you supply, so it ignores transparency and gradients, and passing a ratio never guarantees legibility at tiny sizes or on textured backgrounds. Anything the parser cannot read raises an error naming the offending value. The calculation touches nothing but your own input and runs entirely on-device, so the colours you are testing stay private.',
    },
  ],
  faq: [
    {
      q: 'What is the APCA value?',
      a: 'APCA (Accessible Perceptual Contrast Algorithm,) the successor to WCAG contrast, estimates perceived contrast in Lc units. This is an approximation off the full APCA 0.0.98G algorithm, labelled "approx".',
    },
    {
      q: 'Which colour formats can I type?',
      a: 'Hex in three or six digits (with or without the leading #), rgb() or rgba() functions whose channels may be plain numbers or percentages, and around thirty common CSS names such as black, white, navy, crimson, coral and khaki. Anything else raises an error naming the value it could not read.',
    },
    {
      q: 'What ratios do AA and AAA need?',
      a: 'WCAG 2.1 asks for 4.5 to 1 for normal AA text and 3 to 1 for large AA text; AAA raises these to 7 to 1 and 4.5 to 1. Non-text interface components and graphics need 3 to 1 under AA, which is the graphics row in the table.',
    },
    {
      q: 'Does the checker account for opacity or gradients?',
      a: 'No. It measures the two flat colours you provide, so a semi-transparent text colour or a gradient background must be flattened to a single colour for the result to be meaningful.',
    },
  ],
} as const;
