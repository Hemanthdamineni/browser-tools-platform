/**
 * Editorial content for the significant-figures tool page.
 *
 * Kept out of ``significant-figures.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What a count tells you',
      body: 'For each line the tool counts the significant figures as written, so the precision the author claimed is judged from the digits themselves rather than the number’s magnitude. Scientific and engineering notation are printed for every value, and ambiguous cases are flagged instead of guessed at.',
    },
    {
      heading: 'Trailing zeros and the decimal point',
      body: 'A trailing zero counts only when a decimal point is present, which is why 1200 is marked ambiguous while 1200. and 1.200e3 both state four significant figures. Leading zeros never count: in 0.00450 only the 4, 5 and final 0 are significant. Zeros between non-zero digits always count.',
    },
    {
      heading: 'Rounding to a chosen precision',
      body: 'The Round to significant figures option rebuilds each value to the requested precision, using scientific notation when the exponent would otherwise make the digits unclear. The limit is 21 figures, which covers every precision an IEEE-754 double can represent.',
    },
    {
      heading: 'Notation formats side by side',
      body: 'Scientific notation keeps one digit before the point, engineering notation makes the exponent a multiple of three so it lines up with SI prefixes such as kilo, milli and micro. 1.230e5 becomes 123.0e3, which makes magnitude comparisons across a column of numbers immediate.',
    },
    {
      heading: 'Parsing happens in the page',
      body: 'Each line is analysed locally with plain number parsing; separators like commas, spaces and underscores are ignored. No text is uploaded and no request is made, so even unpublished measurement data stays on your device.',
    },
  ],
  faq: [
    {
      q: 'Why do 1200 and 1200. have different answers?',
      a: 'Trailing zeros only count as significant when a decimal point shows they were measured. 1200 is ambiguous - it could mean two, three or four significant figures - so it is flagged. Writing 1200. or 1.200e3 states four clearly.',
    },
    {
      q: 'How are leading zeros treated?',
      a: 'Zeros before the first non-zero digit never count. In 0.00450 only the 4, 5 and final 0 are significant, which is why it has three significant figures.',
    },
    {
      q: 'What is engineering notation?',
      a: 'Like scientific notation, but the exponent is always a multiple of three so it lines up with SI prefixes such as kilo, milli and micro. 1.230e5 becomes 123.0e3.',
    },
    {
      q: 'Are commas and spaces allowed?',
      a: 'Yes. Thousands separators, spaces and underscores are ignored, so 1,200 and 1_200 are read the same as 1200.',
    },
  ],
} as const;
