/**
 * Editorial content for the matrix-calculator tool page.
 *
 * Kept out of ``matrix-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The operations it performs',
      body: 'Enter matrix A with one row per line and values separated by spaces, commas or tabs, then choose an operation: add, subtract, multiply, transpose, determinant or inverse. Add, subtract and multiply read a second matrix from the Matrix B box that appears for those operations; the others work on A alone.',
    },
    {
      heading: 'Matching dimensions',
      body: 'Addition and subtraction require A and B to have identical shapes, while multiplication needs A’s column count to equal B’s row count — the rule behind A(m×n)·B(n×p). Transpose is always valid, and determinant and inverse require a square matrix, so a rectangular one is rejected for those two.',
    },
    {
      heading: 'Precision and singular matrices',
      body: 'All arithmetic uses JavaScript double-precision floats and results are rounded to 12 significant digits for display, so values are approximate rather than exact. The inverse uses partial pivoting and refuses a matrix whose pivot falls at or below a scale-relative tolerance, because a near-singular inverse is not reliable.',
    },
    {
      heading: 'Size limits',
      body: 'Each matrix is capped at 20 rows by 20 columns to keep the calculation responsive in the browser, which suits the small hand-entered matrices this tool is built for.',
    },
    {
      heading: 'Evaluated locally',
      body: 'Every operation runs in your browser, so the matrices you type are never uploaded.',
    },
  ],
  faq: [
    {
      q: 'How do I enter a matrix?',
      a: 'Put one row on each line. Separate values with spaces, commas, or tabs. Every row must contain the same number of finite decimal values.',
    },
    {
      q: 'What size matrices are supported?',
      a: 'Matrices are limited to 20 rows and 20 columns to keep calculations responsive. Determinants and inverses require square matrices.',
    },
    {
      q: 'How are near-singular matrices handled?',
      a: 'Determinants and inverses use partial pivoting. Inverse rejects pivots at or below a scale-relative tolerance; determinant results may be affected by floating-point rounding.',
    },
  ],
} as const;
