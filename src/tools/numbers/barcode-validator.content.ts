/**
 * Editorial content for the barcode-validator tool page.
 *
 * Kept out of ``barcode-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What gets checked',
      body: 'Paste a retail number, one per line. Spaces and dashes are ignored and only the first line is read. The table reports the format, the digit count, the GS1 country group, the numeric-system prefix, and whether the final digit matches the weighted modulo-10 check.',
    },
    {
      heading: 'Format detection by length',
      body: 'Length decides the label: 6 digits reads as UPC-E, 8 as EAN-8, 12 as UPC-A, 13 as EAN-13 and 14 as GTIN-14, with anything shorter tagged as a plain GTIN. The check digit is always the last digit of the code.',
    },
    {
      heading: 'Computing a check digit',
      body: 'Switch Mode to Compute check digit to work the other way. Give the code without its last digit and the table returns the digit plus the completed barcode, so you can build valid numbers. At least two digits are required.',
    },
    {
      heading: 'When to use it and its limits',
      body: 'Use it to catch a mis-keyed barcode before it reaches a system. The country group comes from the built-in GS1 prefix list, so the company itself is not resolved, and the tool never reads a barcode image. All checks run on your device and the numbers are never sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'What barcode formats do you accept?',
      a: 'UPC-A (12 digits), EAN-13 (13 digits), EAN-8 (8 digits), UPC-E (6 or 8 digits) and any GTIN up to 14 digits. Spaces and dashes between digits are ignored.',
    },
    {
      q: 'How is the check digit computed?',
      a: 'GS1 uses a weighted modulo-10 sum where digits alternate weights 3 and 1 (from the rightmost digit with weight 3). The check digit makes the weighted total a multiple of 10.',
    },
    {
      q: 'Is the manufacturer prefix authoritative?',
      a: 'The country-group (numeric system) is looked up from the GS1 prefix list built into the tool. The company-level prefix is reported as displayed but not resolved to a business name — that requires a licensed lookup.',
    },
    {
      q: 'Does this read barcode images?',
      a: 'No. This validates the numeric code itself. To generate barcodes, use the Barcode / QR generator instead.',
    },
  ],
} as const;
