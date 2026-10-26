/**
 * Editorial content for the pdf-ocr tool page.
 *
 * Kept out of ``pdf-ocr.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What a searchable PDF is',
      body: 'A scan is a picture of a page: a viewer can show it, but search, selection and copy find nothing. A searchable PDF keeps that picture and adds a layer of real text in the same positions, so Ctrl+F, a screen reader and your operating system can all reach the words. This tool reads each page on this device and writes that layer into a brand-new PDF, leaving the visible scan untouched.',
    },
    {
      heading: 'How each page is read',
      body: 'Every selected page is rendered by a local PDF renderer to a bitmap at the render scale you choose, then handed to the Tesseract OCR engine, which reports each word together with the rectangle it occupies. Those rectangles are converted from bitmap pixels back into PDF coordinates — a division by the render scale and a flip of the vertical axis — and drawn with the PDF “invisible” text rendering mode, so they are found by search but paint nothing.',
    },
    {
      heading: 'Languages and render scale',
      body: 'The language models are bundled with the site, so nothing is downloaded from a third party and the first run works offline. Pick the language the document is actually written in: a mismatched model is the single biggest cause of poor results. A higher render scale gives the engine more detail to work with on small print, at the cost of memory and time; 2× suits most scans.',
    },
    {
      heading: 'Limits worth knowing',
      body: 'OCR is a guess, so check names, figures and totals before relying on them. The hidden layer uses a built-in Latin font: words in Chinese, Hindi, Cyrillic and other non-Latin scripts are recognised on the page but cannot be encoded into the layer, so they are skipped while the scan stays readable. Because each page keeps its bitmap, the finished file is larger than a born-digital PDF.',
    },
  ],
  faq: [
    {
      q: 'Is my PDF uploaded anywhere?',
      a: 'No. The pages are rendered and read with a PDF renderer and Tesseract OCR that are both served from this site, so the whole job happens inside your browser.',
    },
    {
      q: 'What does "searchable" mean?',
      a: 'A hidden text layer is written into the PDF at the exact position of every recognised word on the page. The page still shows the original scan, but you can now search, select and copy the text as if it were a born-digital document.',
    },
    {
      q: 'Will the text layer cover the page?',
      a: 'No — the text is written with the PDF “invisible” rendering mode, so it is picked up by search, selection and copy but draws nothing on top of the scan.',
    },
    {
      q: 'Which languages can it read?',
      a: 'The language models are bundled with this site, so no download is needed on first use. English is the default; German, French, Italian, Spanish, Portuguese, Dutch, Russian, Hindi and Simplified Chinese are also available.',
    },
    {
      q: 'Why does a non-Latin page not search well?',
      a: 'The hidden layer uses a built-in Latin font that has no glyphs for scripts such as Chinese, Hindi or Cyrillic, so words in those scripts are skipped from the layer even though the scan stays readable. A Latin-language page is fully searchable.',
    },
  ],
} as const;
