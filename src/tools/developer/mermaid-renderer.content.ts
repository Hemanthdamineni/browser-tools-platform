/**
 * Editorial content for the mermaid-renderer tool page.
 *
 * Kept out of ``mermaid-renderer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Edit and render as you type',
      body: 'Type Mermaid source on the left and the diagram redraws on the right as you go. Keystrokes are debounced, so a burst of typing becomes a single render instead of one per character. Syntax errors appear inline with the line Mermaid stopped on, and the last good diagram stays on screen until you fix it.',
    },
    {
      heading: 'Which diagrams it renders',
      body: 'Anything Mermaid itself understands: flowcharts and graphs, sequence diagrams, class and state diagrams, entity relationship diagrams, Gantt charts, pie and quadrant charts, mind maps, timelines, git graphs, user journeys, requirement diagrams, sankey, block and packet diagrams, XY charts, C4 diagrams and ZenUML. The diagram kind is read from the opening keyword of your source.',
    },
    {
      heading: 'How the SVG is prepared',
      body: 'Rendering happens entirely in this tab. The SVG is rewritten into a self-contained file: the namespace declarations are guaranteed and a viewBox is always present, so the diagram has a real pixel size instead of a percentage width. The preview loads that markup in a sandboxed iframe with no scripts and no same-origin access, and blocks every remote request — a diagram can never fetch anything or reach this page.',
    },
    {
      heading: 'Exporting the result',
      body: 'Export SVG saves the vector file, which stays sharp at any size and edits in any vector tool. Export PNG rasterises the same SVG on a canvas at one to eight pixels per SVG pixel — raise the scale for retina screens or print, lower it for a small file. Both downloads use the file name you set, and the theme option re-renders with the matching Mermaid palette.',
    },
  ],
  faq: [
    {
      q: 'Does the editor send my diagram anywhere?',
      a: 'No. Mermaid runs entirely in your browser and nothing is uploaded — the SVG and PNG exports are generated locally in this tab.',
    },
    {
      q: 'Why does my diagram show a syntax error?',
      a: 'The editor validates the Mermaid source and shows the first problem inline under the editor. Fix the marked line and the render updates automatically.',
    },
    {
      q: 'What is the difference between SVG and PNG export?',
      a: 'SVG is a crisp, infinitely scalable vector format. PNG is a raster image rendered from the same SVG on a canvas, so it is best for sharing where vector files are not supported.',
    },
  ],
} as const;
