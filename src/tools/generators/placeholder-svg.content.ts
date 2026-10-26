/**
 * Editorial content for the placeholder-svg tool page.
 *
 * Kept out of ``placeholder-svg.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The SVG that comes back',
      body: 'Give a width and height and the tool returns an SVG as a base64 data URI: a filled rect with a monospace label centred on it. The output renders as an image preview and is also offered as a downloadable placeholder.svg file, so you can save it once and reuse it across a layout.',
    },
    {
      heading: 'Filling a wireframe or broken image',
      body: 'Use it while a design or a real asset is still being produced. Drop a box of the right size into a mockup to hold the space, or wire it up as a missing-image fallback so a blank spot shows the intended dimensions instead of a broken icon.',
    },
    {
      heading: 'Options that shape the box',
      body: 'Width and height set the canvas in pixels, clamped between 16 and 4000. Background and text colour accept any hex value such as #e2e8f0. The label overrides the default WxH caption, and font size defaults to auto — roughly a sixth of the smaller side, never below 8 points — or a fixed number up to 400.',
    },
    {
      heading: 'What is fixed and what it expects',
      body: 'Colours must be real hex (3 to 8 digits) or the tool errors rather than emitting a malformed SVG. Width and height outside 16 to 4000 are rejected the same way. The label is escaped so characters like & or < never break the markup.',
    },
    {
      heading: 'Generated locally, nothing fetched',
      body: 'The SVG is built by string concatenation in this tab and encoded to base64 in place. Nothing is requested from placeholder services such as via.placeholder.com, so it works offline and never transmits your layout choices.',
    },
  ],
  faq: [
    {
      q: 'Why SVG instead of PNG?',
      a: 'SVG is text — a few hundred bytes, infinitely scalable, and it can be committed to a repo or inlined into HTML. No raster generation is needed.',
    },
    {
      q: 'Can I use any colours?',
      a: 'Any hex colour works. The image is generated in your browser, so nothing is fetched from placeholder services like via.placeholder.com.',
    },
    {
      q: 'How do I control the size of the caption text?',
      a: 'Leave font size at 0 and the tool picks one automatically — about a sixth of the shorter side, with a floor of 8. Set a number instead to pin the size in points, up to 400, and the label stays centred on both axes in a monospace face.',
    },
  ],
} as const;
