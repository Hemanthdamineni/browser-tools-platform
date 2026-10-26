/**
 * Editorial content for the image-ocr tool page.
 *
 * Kept out of ``image-ocr.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Text out of a picture',
      body: 'Drop one or more PNG, JPEG, WebP, GIF or BMP images and each is decoded, normalised to a PNG — which also fixes the orientation a camera stored — and read by a WebAssembly build of Tesseract running in a worker. Every image gets its own text file.',
    },
    {
      heading: 'Scans, screenshots and receipts',
      body: 'It is for the moments when the text you need is trapped inside an image: copying figures out of a screenshot, pulling the lines off a photographed receipt, or turning a scanned page into something you can search. Clean, straight, printed text is where it is strongest.',
    },
    {
      heading: 'The three options',
      body: 'Language tells the engine which model to load — English, German, French, Italian, Spanish, Portuguese, Dutch, Russian, Hindi and Chinese (Simplified) — and each model is downloaded on first use. Text layout describes how the text sits in the picture, with Automatic suiting most images and single-line, block and sparse modes for the rest. Tidy up the spacing removes trailing spaces and stray blank lines.',
    },
    {
      heading: 'Accuracy, size and caveats',
      body: 'Accuracy depends on the image: low contrast, skew and small type all hurt, so check the numbers. The first run downloads the engine (about 3.8 MB) and a language model (0.7–2.9 MB), then caches both. A file that cannot be read is reported on its own.',
    },
    {
      heading: 'The engine runs in your browser',
      body: 'Tesseract and its language models are served from this site and the recognition happens in a worker inside your tab — no image is uploaded and no CDN is contacted. Reading a passport scan or a medical letter here stays on your machine.',
    },
  ],
  faq: [
    {
      q: 'Are my images uploaded?',
      a: 'No. The OCR engine is a WebAssembly build of Tesseract that runs in a Web Worker inside your browser, and the language model is downloaded from this site. Nothing is sent anywhere, and the privacy check in the test suite proves it.',
    },
    {
      q: 'Which languages can it read?',
      a: 'English, German, French, Italian, Spanish, Portuguese, Dutch and Russian. Each language model is a separate file that is only downloaded the first time you use that language.',
    },
    {
      q: 'How accurate is it?',
      a: 'Tesseract is very good at clean, straight, printed text — scans, screenshots and PDFs — and it struggles with handwriting, decorative fonts, low-contrast photos and text that is upside down. Check the numbers before you rely on them.',
    },
    {
      q: 'Why does the first run take a while?',
      a: 'The first run downloads the OCR engine (about 3.8 MB) and the language model (0.7–2.9 MB). Your browser then caches both, so later runs start almost immediately.',
    },
    {
      q: 'Can I read several images at once?',
      a: 'Yes. Drop in as many images as you like and each one is read on its own. Every image gets its own text file, and the recognised text of all of them is shown together above.',
    },
    {
      q: 'What happens to the photos?',
      a: 'Nothing is changed and nothing is stored. The images are read in the tab and thrown away when you close it.',
    },
  ],
} as const;
