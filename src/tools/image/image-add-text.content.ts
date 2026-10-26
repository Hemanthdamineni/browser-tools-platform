/**
 * Editorial content for the image-add-text tool page.
 *
 * Kept out of ``image-add-text.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Placing the text',
      body: 'Type your caption and it appears live as a draggable block. Drag it, or set the horizontal and vertical position fields, which are percentages of the image \u2014 so the export looks the same at any resolution, with 50/85 slightly above the bottom edge on any photo. The arrow keys nudge the focused block by one percent, or ten with Shift.',
    },
    {
      heading: 'Type, size and wrapping',
      body: 'The size slider is a percentage of the image\u2019s short edge, so a caption scales with the picture. Line breaks are kept and long lines wrap at the maximum line width; a single word wider than that is split between characters so it cannot run off the edge. Alignment arranges wrapped lines, and the uppercase switch shouts the caption without retyping it.',
    },
    {
      heading: 'Making text readable on any photo',
      body: 'The outline and drop-shadow controls exist because plain white text disappears over a bright sky. Outline width is a percentage of the font size, so a thick stroke stays proportional, and its colour is independent of the fill. The shadow has its own blur, offsets and colour, and opacity fades the block into a watermark.',
    },
    {
      heading: 'Fonts, formats and privacy',
      body: 'The four fonts are system stacks \u2014 sans, serif, monospace and an Impact-style face \u2014 so no web font is fetched. PNG keeps transparency, JPEG flattens it, and WebP balances size and quality. The whole job runs in a Web Worker in your browser, so the image is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'Where does the text end up?',
      a: 'Exactly where you drag it. The position is stored as a percentage of the image, so the block sits in the same place whatever the resolution.',
    },
    {
      q: 'Can I use my own font?',
      a: 'No web font is downloaded — that would leak a request and break the offline promise. The four choices are system stacks: sans, serif, monospace and an Impact-style caption face.',
    },
    {
      q: 'How do I position the text without a mouse?',
      a: 'Focus the text block on the preview and use the arrow keys: each press moves it 1% of the image, or 10% with Shift held.',
    },
    {
      q: 'What happens to text that is too long?',
      a: 'It wraps at the maximum line width you set. A single word wider than that is split between characters so it never runs off the edge.',
    },
    {
      q: 'Is the image uploaded?',
      a: 'Never. The whole job runs in a Web Worker in your browser; the tool makes no network request at all.',
    },
  ],
} as const;
