import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './fluid-clamp.meta';

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const format = (value: number, digits: number) => String(round(value, digits));

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const minValue = Number(options.minValue);
  const maxValue = Number(options.maxValue);
  const minViewport = Number(options.minViewport);
  const maxViewport = Number(options.maxViewport);
  const rootFontSize = Number(options.rootFontSize);
  const precision = Number(options.precision);
  const unit = String(options.unit);
  const property = String(options.property).trim();

  if (![minValue, maxValue, minViewport, maxViewport, rootFontSize].every(Number.isFinite)) {
    throw new ToolError('All numeric inputs must be finite numbers.');
  }
  if (minViewport <= 0 || maxViewport <= minViewport) {
    throw new ToolError('Maximum viewport must be greater than the positive minimum viewport.');
  }
  if (rootFontSize <= 0) throw new ToolError('Root font size must be positive.');
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
    throw new ToolError('Precision must be a whole number from 0 to 6.');
  }
  if (!['px', 'rem', 'em', 'vw'].includes(unit)) throw new ToolError('Choose px, rem, em, or vw units.');
  if (property && !/^--[\w-]+$|^[a-z][a-z0-9-]*$/i.test(property)) {
    throw new ToolError('Enter a valid CSS property name or leave it blank.');
  }

  const divisor = unit === 'rem' || unit === 'em' ? rootFontSize : 1;
  const minCss = minValue / divisor;
  const maxCss = maxValue / divisor;
  const slopeVw = ((maxValue - minValue) / (maxViewport - minViewport)) * 100;
  const interceptPx = minValue - (slopeVw / 100) * minViewport;
  const interceptCss = interceptPx / divisor;
  const lowerBound = Math.min(minCss, maxCss);
  const upperBound = Math.max(minCss, maxCss);
  const preferred = `${format(interceptCss, precision)}${unit} ${slopeVw < 0 ? '-' : '+'} ${format(Math.abs(slopeVw), precision)}vw`;
  const clamp = `clamp(${format(lowerBound, precision)}${unit}, ${preferred}, ${format(upperBound, precision)}${unit})`;
  const output = property ? `${property}: ${clamp};` : clamp;

  const notes = [
    `At ${format(minViewport, 0)}px viewport: ${format(minCss, precision)}${unit} (minimum).`,
    `At ${format(maxViewport, 0)}px viewport: ${format(maxCss, precision)}${unit} (maximum).`,
    ...(minValue > maxValue ? ['The preferred value decreases as the viewport grows.'] : []),
  ];

  return {
    output,
    render: 'code',
    language: 'css',
    stats: { 'minimum value': `${format(minCss, precision)}${unit}`, 'maximum value': `${format(maxCss, precision)}${unit}`, 'viewport range': `${format(minViewport, 0)}–${format(maxViewport, 0)}px` },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
