import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './nato-phonetic.meta';

const LETTERS: Record<string, string> = {
  A: 'Alfa',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  F: 'Foxtrot',
  G: 'Golf',
  H: 'Hotel',
  I: 'India',
  J: 'Juliett',
  K: 'Kilo',
  L: 'Lima',
  M: 'Mike',
  N: 'November',
  O: 'Oscar',
  P: 'Papa',
  Q: 'Quebec',
  R: 'Romeo',
  S: 'Sierra',
  T: 'Tango',
  U: 'Uniform',
  V: 'Victor',
  W: 'Whiskey',
  X: 'X-ray',
  Y: 'Yankee',
  Z: 'Zulu',
};

const DIGITS: Record<string, string> = {
  '0': 'Zero',
  '1': 'One',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Niner',
};

const FROM_WORD: Record<string, string> = (() => {
  const rev: Record<string, string> = {};
  for (const key of Object.keys(LETTERS)) rev[LETTERS[key]!.toLowerCase()] = key;
  for (const key of Object.keys(DIGITS)) rev[DIGITS[key]!.toLowerCase()] = key;
  return rev;
})();

function toPhonetic(text: string): string {
  const tokens: string[] = [];
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    const upper = ch.toUpperCase();
    if (LETTERS[upper]) tokens.push(LETTERS[upper]!);
    else if (DIGITS[ch]) tokens.push(DIGITS[ch]!);
    else tokens.push(ch);
  }
  return tokens.join(' ');
}

function fromPhonetic(text: string): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let matches = 0;
  const out = tokens
    .map((token) => {
      const mapped = FROM_WORD[token.toLowerCase()];
      if (mapped != null) {
        matches++;
        return mapped;
      }
      return token;
    })
    .join('');

  if (tokens.length > 0 && matches === 0) {
    throw new ToolError(
      'No NATO phonetic words found in the input.',
      'Switch to "Text → Phonetic", or check the spelling (Alfa, Bravo, Charlie…).',
    );
  }
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  if (o.mode === 'phonetic-to-text') {
    return { output: fromPhonetic(input.text) };
  }
  const output = toPhonetic(input.text);
  return { output, render: 'code' };
}

const tool: TextToolModule = { meta, run };
export default tool;
