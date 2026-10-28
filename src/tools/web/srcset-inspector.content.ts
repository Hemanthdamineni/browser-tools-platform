/**
 * Editorial content for the srcset-inspector tool page.
 *
 * Kept out of ``srcset-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Paste the value of an img srcset attribute — and optionally its sizes attribute — and the inspector parses it by the WHATWG HTML algorithms. Every candidate is listed with its URL: its declared descriptor, a width in w or a density in x, and the effective density a browser would assign it; width descriptors are divided by the resolved source size, which is how a browser turns a w into its density. A view selector shows the selected source instead: no candidates, just the one the browser would download at the chosen viewport: DPR.',
    },
    {
      heading: 'How the source size is resolved',
      body: 'When candidates use width descriptors, an sizes attribute tells the browser how wide the image slot will be on the page — a comma-separated list of media conditions and CSS lengths, usually ending in a bare default. The first media condition that matches wins. If the element has no sizes attribute the built-in default is 100vw, the full viewport width. The inspector evaluates the same conditions it can parse and warns on anything it does not understand, so the density it prints is never silently guessed.',
    },
    {
      heading: 'What counts as an error',
      body: 'A single candidate may carry a w or an x descriptor, never both. One srcset cannot mix width candidates with density candidates. Widths must be positive integers, and densities positive numbers. A trailing comma on a candidate, a URL containing a comma without quotes, and an empty srcset are all malformed. Warnings are reserved for cases the browser tolerates, like duplicated widths where the last candidate wins.',
    },
    {
      heading: 'When it disagrees with the browser',
      body: 'Two inputs make the browser choose differently: the network, which may pick a larger or smaller candidate through its density selection, and the actual layout width of the slot, which depends on the CSS around the element. The inspector models the stylesheet contract (sizes and the viewport) rather than a particular render, so use it to catch authoring mistakes, not to predict a pixel-exact download on every device.',
    },
  ],
  faq: [
    {
      q: 'Why does a 2x candidate have density 2 if I wrote a width?',
      a: 'A browser cannot use a width descriptor directly. It divides the declared width by the source size that sizes resolves to, which yields an effective density. That density, not the width in w, is what leads selection, so the inspector prints it.',
    },
    {
      q: 'What is the default source size?',
      a: 'One viewport. If sizes is missing, or has only media conditions that do not match, the source size is 100vw. That is why 800w with no sizes is roughly 0.625x on a 1280px viewport — it describes the slot, not the image.',
    },
    {
      q: 'Will the browser always download the selected candidate?',
      a: 'Not necessarily. The network is allowed to re-pick, and cache, preload and round-page behaviour override this sometimes. The inspector is a model of the markup at the given options, so use it to validate the contract you wrote, not to predict bytes on the wire.',
    },
    {
      q: 'Why does a density candidate leave the Width column empty?',
      a: 'A density descriptor fixes no delivered-pixel width. Width is a property of width descriptors; for density candidates the browser uses the CSS size the slot resolves to and the descriptor is used as the pixel ratio. The tool keeps the two columns distinct for that reason.',
    },
  ],
} as const;
