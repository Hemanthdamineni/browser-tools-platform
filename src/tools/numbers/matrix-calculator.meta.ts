import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'matrix-calculator',
  name: 'Matrix Calculator',
  category: 'numbers',
  summary: 'Add, multiply, transpose, and find the determinant or inverse of small matrices.',
  description:
    'Calculate common operations on matrices using decimal numbers. Enter rows as comma-, space-, or tab-separated values; use a second matrix for addition and multiplication. All calculations run locally.',
  keywords: [
    'matrix calculator',
    'matrix addition',
    'matrix multiplication',
    'matrix transpose',
    'matrix determinant',
    'matrix inverse',
    'linear algebra',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      default: 'multiply',
      choices: [
        { value: 'add', label: 'Add (A + B)' },
        { value: 'subtract', label: 'Subtract (A − B)' },
        { value: 'multiply', label: 'Multiply (A × B)' },
        { value: 'transpose', label: 'Transpose (Aᵀ)' },
        { value: 'determinant', label: 'Determinant (det A)' },
        { value: 'inverse', label: 'Inverse (A⁻¹)' },
      ],
    },
    {
      key: 'matrixB',
      label: 'Matrix B (one row per line)',
      type: 'textarea',
      default: '5 6\n7 8',
      placeholder: '5 6\n7 8',
      showWhen: { key: 'operation', value: 'add' },
    },
    {
      key: 'matrixBMultiply',
      label: 'Matrix B (one row per line)',
      type: 'textarea',
      default: '5 6\n7 8',
      placeholder: '5 6\n7 8',
      showWhen: { key: 'operation', value: 'multiply' },
    },
    {
      key: 'matrixBSubtract',
      label: 'Matrix B (one row per line)',
      type: 'textarea',
      default: '5 6\n7 8',
      placeholder: '5 6\n7 8',
      showWhen: { key: 'operation', value: 'subtract' },
    },
  ],
  examples: [
    { title: 'Multiply two 2×2 matrices', input: '1 2\n3 4' },
    { title: 'Find a determinant', input: '3 8\n4 6', options: { operation: 'determinant' } },
    { title: 'Transpose a 2×3 matrix', input: '1 2 3\n4 5 6', options: { operation: 'transpose' } },
  ],
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
  related: ['number-base', 'statistics-calculator'],
  status: 'stable',
};
