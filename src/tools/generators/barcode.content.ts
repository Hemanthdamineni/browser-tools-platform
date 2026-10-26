/**
 * Editorial content for the barcode tool page.
 *
 * Kept out of ``barcode.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From a string to a scannable vector barcode',
      body: 'Type a string or a product number, choose a symbology, and the generator returns a standalone vector barcode to print or embed. Nine 1D symbologies plus 2D DataMatrix are covered, and because the output is SVG it stays crisp at any size and can be copied out or embedded as a data URI.',
    },
    {
      heading: 'Picking the right symbology',
      body: 'Code 128 is the general-purpose default — compact and able to hold the full ASCII range. Retail products need EAN-13, EAN-8 or UPC-A, shipping cartons use ITF-14, older industrial systems still read Code 39, and DataMatrix packs a lot of text into a small square for components and medical devices.',
    },
    {
      heading: 'Check digits and quiet zones',
      body: 'The GTIN symbologies build their own mod-10 check digit: enter the short form and it is appended for you, or supply every digit and it is verified. Code 128 always carries its own checksum. The quiet zone keeps a blank margin of modules on either side of the bars, and leaving it at ten or more is what lets a scanner lock on.',
    },
    {
      heading: 'Options that change the printed result',
      body: 'Module width is the width of the narrowest bar and should stay at 2 px or more for reliable scans; bar height and the human-readable line are cosmetic. Bar colour and background are hex values, and a background of none gives a transparent SVG. DataMatrix ignores the readable text line because it is machine-read only.',
    },
    {
      heading: 'Encoded in this tab',
      body: 'Every bar is computed in the page: the payload, colours and layout are never sent anywhere, so nothing is uploaded and the tool keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'Which symbology should I use?',
      a: 'Code 128 is the best general-purpose choice — compact and it handles the full ASCII range. Choose EAN-13 / EAN-8 / UPC-A for products sold in stores, Code 39 for older industrial or asset-tag systems, ITF-14 for shipping cartons, and DataMatrix when you need a small 2D symbol that fits a lot of data into a tight square.',
    },
    {
      q: 'What is DataMatrix and when should I use it?',
      a: 'DataMatrix is a 2D code (ECC200) that packs a lot of data into a small square — common on electronics, medical devices and parts. It handles any text (encoded as UTF-8) and needs no check digit from you. Use it when a 1D barcode would be too wide.',
    },
    {
      q: 'Does it add the check digit?',
      a: 'Yes. EAN-13, EAN-8, UPC-A and ITF-14 get their GTIN mod-10 check digit appended automatically when you enter the shorter form, and it is verified when you supply all digits. Code 128 always includes its own checksum.',
    },
    {
      q: 'Will the barcode actually scan?',
      a: 'Yes, at the right size. Leave the quiet zone at 10 modules or more and use a module width of at least 2 px, then print at 100% (do not scale to fit a smaller box, which blurs the bars).',
    },
    {
      q: 'Why SVG?',
      a: 'A vector file stays perfectly crisp at any size, which is exactly what scanners and printers want — and it is a fraction of the size of a bitmap. The code is generated entirely on your device; nothing is uploaded.',
    },
  ],
} as const;
