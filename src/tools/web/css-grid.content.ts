/**
 * Editorial content for the css-grid tool page.
 *
 * Kept out of ``css-grid.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'One rule from tracks, gaps and alignment',
      body: 'The generator assembles a single CSS declaration block from your column and row track lists, a base gap with optional column-gap and row-gap overrides, then justify-items and align-items from the four accepted values (stretch, start, end, center). Copy the block straight into a stylesheet — it is a plain rule with a simple selector, not a full theme.',
    },
    {
      heading: 'What the validation will refuse',
      body: 'Every track and gap value must be one simple token or function: a length, percentage, fr unit, auto, or a minmax(), repeat(), fit-content() or clamp() call. Braces and semicolons are rejected and values are capped at 300 characters, so you cannot smuggle extra declarations through a text field. The selector must be a plain class, id or element pattern such as .layout or #app.',
    },
    {
      heading: 'Named areas must form rectangles',
      body: 'Type a space-aligned matrix into the areas box and each name has to fill one contiguous rectangle; dots mark deliberately empty cells. Every row must hold the same number of cells and the matrix is capped at 50 by 50, so a typo comes back as an error rather than an invalid grid-template-areas value.',
    },
    {
      heading: 'A single rule, not a responsive system',
      body: 'Nothing here emits media queries — pair the output with repeat(auto-fit, minmax(…)) for fluid columns, or wrap it in your own breakpoints. The rule is generated in the browser and the values you type are never sent to a server.',
    },
  ],
  faq: [
    {
      q: 'What syntax can tracks use?',
      a: 'Common CSS track syntax is accepted, including lengths, percentages, fr units, minmax(), repeat(), auto-fit, and auto-fill. The generator validates basic safety and non-empty declarations but does not fully parse CSS.',
    },
    {
      q: 'How are named areas validated?',
      a: 'Each non-dot area name must occupy one contiguous rectangle in the matrix. Every row must contain the same number of cells, and the optional dot represents an intentionally empty cell.',
    },
    {
      q: 'Does this add responsive breakpoints?',
      a: 'No. It generates one grid rule. Use repeat(auto-fit, minmax(...)) for many responsive layouts, or compose the output with media queries yourself.',
    },
  ],
} as const;
