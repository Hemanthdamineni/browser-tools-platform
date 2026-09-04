import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './gradient-css.meta';

const NAMED_COLOURS = new Set([
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'silver',
  'maroon',
  'navy',
  'olive',
  'lime',
  'aqua',
  'cyan',
  'magenta',
  'teal',
  'brown',
  'transparent',
  'currentColor',
]);

/** Permissive hex/rgb()/hsl()/named check — CSS validity is the browser's job. */
function isColour(token: string): boolean {
  const t = token.toLowerCase();
  if (NAMED_COLOURS.has(t)) return true;
  if (/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(t)) return true;
  if (/^(rgba?|hsla?)\(\s*[\d.]+%?[\s,]+[\d.]+%?[\s,]+[\d.]+%?(\s*[/,]\s*[\d.%]+)?\s*\)$/i.test(t))
    return true;
  return false;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const rawStops = String(o.stops);
  const stopLines = rawStops
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: string[] = [];
  let firstColour = '';
  for (const line of stopLines) {
    const parts = line.split(/\s+/);
    const colour = parts[0]!;
    if (!isColour(colour)) {
      throw new ToolError(`"${colour}" is not a colour.`);
    }
    if (!firstColour) firstColour = colour;
    parsed.push(parts.length > 1 ? `${colour} ${parts.slice(1).join(' ')}` : colour);
  }
  if (parsed.length < 2) {
    throw new ToolError('Add at least two colour stops.');
  }

  const type = String(o.type);
  const angle = Number(o.angle) || 0;
  let fn: string;
  if (type === 'radial') {
    fn = `radial-gradient(${String(o.shape)}, ${parsed.join(', ')})`;
  } else if (type === 'conic') {
    fn = `conic-gradient(from ${angle}deg, ${parsed.join(', ')})`;
  } else {
    fn = `linear-gradient(${angle}deg, ${parsed.join(', ')})`;
  }

  const css = `background-color: ${firstColour};\nbackground-image: ${fn};`;
  return { output: css, render: 'code', language: 'css' };
}

const tool: TextToolModule = { meta, run };
export default tool;
