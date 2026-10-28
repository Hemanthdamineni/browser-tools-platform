/**
 * Editorial content for the border-radius tool page.
 *
 * Kept out of ``border-radius.meta.ts`` so the eager client registry never ships
 * this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Why did my four values become one?',
      a: 'CSS collapses equal corners: four identical values become one, opposite pairs that match become two, and a matching bottom-right/bottom-left pair become three. The generator emits the shortest form that preserves the shape.',
    },
    {
      q: 'When do I need the slash syntax?',
      a: 'The `x / y` form makes each corner elliptical — different horizontal and vertical radii. A value of `50% / 25%` gives a lozenge; plain `50%` gives a circle.',
    },
    {
      q: 'Does this work on any element?',
      a: 'Yes. border-radius applies to any box, but it only clips content when the element establishes a clipping context, for example with `overflow: hidden` on an image wrapper.',
    },
  ],
} as const;
