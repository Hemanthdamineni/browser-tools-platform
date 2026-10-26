/**
 * Editorial content for the image-blur-redact tool page.
 *
 * Kept out of ``image-blur-redact.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Draw, choose an effect, export',
      body: 'Open a PNG, JPEG or WebP, draw one or more rectangles over the areas you want gone, then export. Each region can take its own effect — blur, pixelate or a solid black box — and the tool-wide setting covers any region that does not override it. The result is a re-encoded copy with the effect applied to the real pixels.',
    },
    {
      heading: 'The regions are percentages, not pixels',
      body: 'The rectangles live in the “Redaction regions” field as an array of { x, y, w, h } values in percent of the image, each with an optional effect. That means changing the blur radius or export format reuses the same regions, and you can edit the JSON by hand if you are scripting the workflow.',
    },
    {
      heading: 'Why a real redaction beats an overlay',
      body: 'The effect is baked into the exported pixels when the file is re-encoded — nothing is kept as a layer, mask or overlay, so a viewer cannot peel it back. Strong pixelation or a black box hides the most; a light blur can still hint at what was underneath, so keep the radius high and the rectangle generous.',
    },
    {
      heading: 'Metadata goes with it',
      body: 'The export is redrawn through a canvas and encoded from scratch, so EXIF, GPS, XMP, IPTC, the ICC profile and comments are all gone, and there is no option to keep them. The stored EXIF orientation is applied while decoding, so a phone photo comes out the right way up.',
    },
    {
      heading: 'The pixels stay on your device',
      body: 'Drawing, the box blur, the pixelation averaging and the final encode all happen in this tab. At 0% effect opacity nothing is redacted at all, so check the exported file before you send it.',
    },
  ],
  faq: [
    {
      q: 'Can anyone undo the blur?',
      a: 'No. The effect is baked into the exported pixels when the file is re-encoded — nothing is stored as a layer, mask or overlay, so a viewer cannot reveal the original. Strong pixelation or a black box hides the most; a light blur can still hint at what was underneath, so keep the radius high and the rectangle generous.',
    },
    {
      q: 'Which metadata is removed?',
      a: 'All of it. The export is redrawn through a canvas and encoded from scratch, so EXIF, GPS, XMP, IPTC, the ICC profile and comments are gone. There is no option to keep them — a redacted copy should not carry a location with it.',
    },
    {
      q: 'Do the regions survive a re-run?',
      a: 'Yes. The rectangles you draw live in the “Redaction regions” field as percentages, so changing the effect, the radius or the export format re-uses the same regions without redrawing them.',
    },
    {
      q: 'Which files can I use?',
      a: 'PNG, JPEG and WebP. Other formats should be converted first with the Image Converter.',
    },
    {
      q: 'Why does my phone photo come out the right way up?',
      a: 'The stored EXIF orientation is applied while decoding, so the rotation is baked into the pixels, and the tag itself is dropped with the rest of the metadata.',
    },
    {
      q: 'Is anything uploaded?',
      a: 'No. Drawing, blurring and encoding all happen in your browser; the image never leaves your device.',
    },
  ],
} as const;
