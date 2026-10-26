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
  related: ['number-base', 'statistics-calculator'],
  status: 'stable',
};
