/**
 * Editorial content for the fluid-clamp tool page.
 *
 * Kept out of ``fluid-clamp.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A clamp() line built from two value and viewport pairs',
      body: 'Give a value at a narrow viewport and one at a wide viewport; the tool solves the straight line between them. The output is a bare clamp() expression or, with the property box filled, a complete declaration such as "font-size: clamp(1rem, 0.648rem + 1.502vw, 2rem);" that pastes straight into a stylesheet.',
    },
    {
      heading: 'Why you would reach for it instead of a media query',
      body: 'A heading that jumps from 16px to 32px at a breakpoint stays small on a 1100px laptop until the breakpoint hits. Interpolating instead grows the size smoothly with the window, with no JavaScript, no resize listener and no second rule to maintain. Spacing scales the same way: padding-block from 8px to 48px is one line rather than two.',
    },
    {
      heading: 'Options that change the arithmetic',
      body: 'The unit selector decides where numbers land: px keeps them, while rem and em divide both bounds and the intercept by the root font size, configurable and defaulting to 16px. The slope always comes out in viewport-width percentage from your px inputs, so switching units moves the bounds without changing the growth rate. Decimal places (0 to 6) set rounding, and the property box takes a custom property such as --gap or a plain name.',
    },
    {
      heading: 'Edge cases worth knowing before you paste it',
      body: 'The maximum viewport must exceed a positive minimum and the root font size must be positive, or the tool errors instead of printing nonsense. If the maximum value is below the minimum a note says the value shrinks as the viewport grows and the bounds stay smallest-first.',
    },
    {
      heading: 'Calculated in the browser, not on a server',
      body: 'The interpolation is plain arithmetic in the tab; breakpoints, root font size and property name are never posted anywhere.',
    },
  ],
  faq: [
    {
      q: 'What does the generated clamp do?',
      a: 'It keeps the value at or above the minimum, scales linearly with viewport width between the chosen breakpoints, and caps it at the maximum.',
    },
    {
      q: 'Does the rem calculation assume a 16px root size?',
      a: 'The root font size is configurable and defaults to 16px. The generated CSS uses rem bounds and a viewport-width slope calculated against that root size.',
    },
    {
      q: 'Is the formula exact at both viewport bounds?',
      a: 'Yes, modulo the selected decimal precision. The computed preferred value equals the minimum at the minimum viewport and the maximum at the maximum viewport.',
    },
  ],
} as const;
