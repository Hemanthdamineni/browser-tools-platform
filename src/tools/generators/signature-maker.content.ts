/**
 * Editorial content for the signature-maker tool page.
 *
 * Kept out of ``signature-maker.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the signature maker does',
      body: 'A signature pad and a typed-name form side by side. Draw with a mouse, finger or stylus on the transparent pad, or type a name and pick a cursive, classic, modern or typewriter style. Whatever you make appears in the preview, and you download it as a transparent PNG or SVG that can be dropped onto a document, image, email or web form.',
    },
    {
      heading: 'When to use it',
      body: 'Whenever you need your own mark as an image file — a contract, a PDF, an approval box on a screenshot, or a digital watermark. Because the export keeps only the ink and nothing else, it sits on any background colour without a white box around it.',
    },
    {
      heading: 'The two export formats',
      body: 'SVG is a vector: a few hundred bytes that stays razor sharp at any size, so it is ideal for print or for committing to a codebase. PNG is the pixel version, exported at the full drawing resolution, which most document editors expect. Both keep their alpha channel, so the background stays transparent.',
    },
    {
      heading: 'How the strokes stay smooth',
      body: 'The pad records the raw pointer positions and runs a corner-cutting smoothing pass over them before drawing. That takes the jitter out of a finger or mouse trace while keeping the stroke exactly where you drew it, from the first touch to the last.',
    },
    {
      heading: 'Privacy and fonts',
      body: 'Everything is produced in this tab: the strokes are never uploaded, and the typed signature uses generic system fonts — cursive, serif, sans-serif and monospace — so no webfont is fetched and no font licence is carried. The tool works fully offline.',
    },
  ],
  faq: [
    {
      q: 'Is the signature transparent?',
      a: 'Yes. The pad is transparent and only the ink is exported, so the signature drops cleanly onto white or any other page colour. SVG export has no background element at all.',
    },
    {
      q: 'Is the PNG or SVG lossless?',
      a: 'Both. SVG is a vector that scales to any size without blur, and the PNG is exported at the full drawing resolution so it stays sharp when scaled down.',
    },
    {
      q: 'Where do the typed fonts come from?',
      a: 'They are generic font stacks already on your device — cursive, serif, sans-serif and monospace. Nothing is fetched from the web, so the tool works offline and no font licence needs to be carried.',
    },
  ],
} as const;
