/**
 * Editorial content for the box-shadow tool page.
 *
 * Kept out of ``box-shadow.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A rule you can paste',
      body: 'Set the horizontal and vertical offset, the blur radius, the spread and a colour, and the tool writes a complete box-shadow declaration you can drop straight into a stylesheet. The result is the finished rule in CSS syntax, so there is nothing to assemble by hand and no chance of transposing the offset and blur values.',
    },
    {
      heading: 'What each value does',
      body: 'Offset X and Y move the shadow relative to the element — a positive Y pushes it down, the usual "light from above" look. Blur softens the edge; 0 gives a hard copy of the box. Spread grows or shrinks the shadow before blurring, so a negative spread tightens it. Inset draws the shadow inside the element, which is how pressed and recessed surfaces are made.',
    },
    {
      heading: 'Layered shadows for believable depth',
      body: 'A single shadow with a big blur looks flat and artificial. Raise Layers to 2–6 and the tool emits several shadows in one declaration, each with a fraction of the offset, blur and spread and a proportionally smaller alpha, so the stack builds a soft, natural elevation rather than a grey halo. The final layer uses the exact values you entered.',
    },
    {
      heading: 'Colour and comma syntax',
      body: 'The colour accepts any CSS colour, but an rgba() value with partial alpha is what makes a shadow feel like light rather than paint — the default is a 15% black. Multiple layers are joined with commas inside the single declaration, which is legal CSS and supported everywhere, so the rule copies as one line.',
    },
    {
      heading: 'Built locally',
      body: 'The declaration is pure string building in this tab — no design service is queried and no styles are uploaded. Your theme colours stay private, and the tool works offline once the page has loaded.',
    },
  ],
  faq: [
    {
      q: 'How does layered mode scale the shadows?',
      a: 'Layer i of N uses offset/blur/spread multiplied by i/N and the colour alpha divided by i. It mimics the multi-shadow "elevation" technique popularised by Material Design.',
    },
    {
      q: 'What does a negative spread do?',
      a: 'Spread grows the shadow before it is blurred, so a negative value shrinks it — the shadow hugs the element more tightly and reads as a crisper edge. It is the trick behind thin, precise borders of shadow.',
    },
    {
      q: 'Can I use any CSS colour format?',
      a: 'Yes, the colour field accepts hex, rgb(), hsl() and named colours, but a value with partial alpha such as rgba(0, 0, 0, 0.15) is what makes a shadow look like light instead of a grey band. Fully opaque colours tend to look heavy.',
    },
  ],
} as const;
