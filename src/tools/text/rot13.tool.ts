import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './rot13.meta';

/** Rotate ASCII letters by `shift` positions, preserving case. */
function rotLetters(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text.replace(/[A-Za-z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code <= 90 ? 65 : 97;
    return String.fromCharCode(((code - base + s) % 26) + base);
  });
}

/** Rotate ASCII digits by `shift` positions. */
function rotDigits(text: string, shift: number): string {
  const s = ((shift % 10) + 10) % 10;
  return text.replace(/[0-9]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 48 + s) % 10) + 48));
}

/** Rotate every printable ASCII character (33..126) by 47. Self-inverse. */
function rot47(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (ch.length === 1 && code >= 33 && code <= 126) {
      out += String.fromCharCode(33 + ((code - 33 + 47) % 94));
    } else {
      out += ch;
    }
  }
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const variant = String(o.variant);
  let output: string;

  switch (variant) {
    case 'rot5':
      output = rotDigits(input.text, 5);
      break;
    case 'rot18':
      output = rotDigits(rotLetters(input.text, 13), 5);
      break;
    case 'rot47':
      output = rot47(input.text);
      break;
    case 'caesar': {
      const shift = Math.trunc(Number(o.shift));
      if (!Number.isFinite(shift) || shift < 1 || shift > 25) {
        throw new ToolError(
          'Caesar shift must be a whole number from 1 to 25.',
          'Adjust the "Caesar shift" option.',
        );
      }
      output = rotLetters(input.text, shift);
      break;
    }
    case 'rot13':
    default:
      output = rotLetters(input.text, 13);
      break;
  }

  return {
    output,
    render: 'code',
    stats: { characters: [...input.text].length, variant },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
