import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './calculator.meta';
import { evaluateExpression, formatNumber } from './calculator.core';

/*
 * The parser, the function registry and the constants live in
 * `calculator.core.ts` (pure, unit-tested on its own) so the keypad panel can
 * reuse exactly the same evaluator. This module is only the tool shell:
 * resolve the options, run the parser, format the result.
 */

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };

  const precision = Math.max(0, Math.min(15, Math.floor(Number(o.precision) || 10)));
  const degrees = String(o.angleMode) === 'degrees';

  const value = evaluateExpression(text, { degrees });
  if (value === null) return { output: '' };
  if (!Number.isFinite(value)) {
    throw new ToolError(
      'The expression does not evaluate to a finite number.',
      'Check for empty function arguments, overflow, or invalid domains.',
    );
  }
  const formatted = formatNumber(value, precision);

  return {
    output: formatted,
    render: 'text',
    stats: { result: formatted },
    notes: [`Parsed expression: ${text}`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
