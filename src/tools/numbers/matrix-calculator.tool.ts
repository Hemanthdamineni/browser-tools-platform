import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './matrix-calculator.meta';

type Matrix = number[][];
const MAX_DIMENSION = 20;
const PIVOT_TOLERANCE = 1e-12;

function parseMatrix(text: string, label: string): Matrix {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length)
    throw new ToolError(`${label} is empty.`, 'Enter at least one row of numbers.');
  if (lines.length > MAX_DIMENSION) {
    throw new ToolError(`${label} exceeds ${MAX_DIMENSION} rows.`);
  }

  const matrix = lines.map((line, index) => {
    const values = line.split(/[\s,]+/).filter(Boolean);
    if (!values.length) throw new ToolError(`${label} row ${index + 1} is empty.`);
    if (values.length > MAX_DIMENSION) {
      throw new ToolError(`${label} exceeds ${MAX_DIMENSION} columns.`);
    }
    return values.map((value) => {
      const number = Number(value);
      if (value === '' || !Number.isFinite(number)) {
        throw new ToolError(`Invalid number in ${label}, row ${index + 1}: "${value}".`);
      }
      return number;
    });
  });

  const width = matrix[0]!.length;
  if (matrix.some((row) => row.length !== width)) {
    throw new ToolError(
      `${label} must be rectangular.`,
      'Make sure every row has the same number of values.',
    );
  }
  return matrix;
}

function requireSquare(matrix: Matrix, operation: string): void {
  if (matrix.length !== matrix[0]!.length) {
    throw new ToolError(`${operation} requires a square matrix.`);
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new ToolError('The result exceeded the numeric range.');
  if (Object.is(value, -0) || Math.abs(value) < 1e-14) return '0';
  return Number(value.toPrecision(12)).toString();
}

function formatMatrix(matrix: Matrix): string {
  return matrix.map((row) => row.map(formatNumber).join('\t')).join('\n');
}

function determinant(matrix: Matrix): number {
  const n = matrix.length;
  const work = matrix.map((row) => [...row]);
  let sign = 1;
  let result = 1;
  for (let column = 0; column < n; column++) {
    let pivotRow = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(work[row]![column]!) > Math.abs(work[pivotRow]![column]!)) pivotRow = row;
    }
    const pivot = work[pivotRow]![column]!;
    if (pivot === 0) return 0;
    if (pivotRow !== column) {
      [work[pivotRow], work[column]] = [work[column]!, work[pivotRow]!];
      sign *= -1;
    }
    const diagonal = work[column]![column]!;
    result *= diagonal;
    for (let row = column + 1; row < n; row++) {
      const factor = work[row]![column]! / diagonal;
      for (let c = column + 1; c < n; c++) {
        work[row]![c] = work[row]![c]! - factor * work[column]![c]!;
      }
    }
  }
  return sign * result;
}

function inverse(matrix: Matrix): Matrix {
  const n = matrix.length;
  const work = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => Number(i === j)),
  ]);
  const scale = Math.max(...matrix.flat().map(Math.abs), 1);
  for (let column = 0; column < n; column++) {
    let pivotRow = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(work[row]![column]!) > Math.abs(work[pivotRow]![column]!)) pivotRow = row;
    }
    if (Math.abs(work[pivotRow]![column]!) <= scale * PIVOT_TOLERANCE) {
      throw new ToolError('This matrix is singular or too close to singular to invert reliably.');
    }
    [work[pivotRow], work[column]] = [work[column]!, work[pivotRow]!];
    const pivot = work[column]![column]!;
    for (let c = 0; c < 2 * n; c++) work[column]![c] = work[column]![c]! / pivot;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = work[row]![column]!;
      for (let c = 0; c < 2 * n; c++) {
        work[row]![c] = work[row]![c]! - factor * work[column]![c]!;
      }
    }
  }
  return work.map((row) => row.slice(n));
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const operation = String(options.operation);
  const a = parseMatrix(input.text, 'Matrix A');
  let result: Matrix | number;
  let stats: Record<string, string | number>;

  if (operation === 'add' || operation === 'subtract' || operation === 'multiply') {
    const optionKey =
      operation === 'multiply'
        ? 'matrixBMultiply'
        : operation === 'subtract'
          ? 'matrixBSubtract'
          : 'matrixB';
    const b = parseMatrix(String(options[optionKey] ?? ''), 'Matrix B');
    if (operation === 'multiply') {
      if (a[0]!.length !== b.length) {
        throw new ToolError('Columns in A must equal rows in B for multiplication.');
      }
      result = Array.from({ length: a.length }, (_, row) =>
        Array.from({ length: b[0]!.length }, (_, column) =>
          a[row]!.reduce((sum, value, k) => sum + value * b[k]![column]!, 0),
        ),
      );
    } else {
      if (a.length !== b.length || a[0]!.length !== b[0]!.length) {
        throw new ToolError(`Matrix dimensions do not match for ${operation}.`);
      }
      result = a.map((row, i) =>
        row.map((value, j) => (operation === 'add' ? value + b[i]![j]! : value - b[i]![j]!)),
      );
    }
    stats = { operation, rows: (result as Matrix).length, columns: (result as Matrix)[0]!.length };
  } else if (operation === 'transpose') {
    result = Array.from({ length: a[0]!.length }, (_, column) => a.map((row) => row[column]!));
    stats = { operation, rows: (result as Matrix).length, columns: (result as Matrix)[0]!.length };
  } else if (operation === 'determinant') {
    requireSquare(a, 'Determinant');
    result = determinant(a);
    stats = { operation, rows: a.length, columns: a.length };
  } else if (operation === 'inverse') {
    requireSquare(a, 'Inverse');
    result = inverse(a);
    stats = { operation, rows: (result as Matrix).length, columns: (result as Matrix)[0]!.length };
  } else {
    throw new ToolError('Unknown matrix operation.');
  }

  return {
    output: typeof result === 'number' ? formatNumber(result) : formatMatrix(result),
    render: 'code',
    language: 'text',
    filename: 'matrix-result.txt',
    stats,
    notes: [
      'Values use JavaScript double-precision floating-point arithmetic; displayed results are rounded to 12 significant digits.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
