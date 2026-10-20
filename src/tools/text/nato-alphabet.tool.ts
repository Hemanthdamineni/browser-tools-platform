import { ToolError } from '@/lib/types';
import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './nato-alphabet.meta';

const LETTERS: Record<string, string> = {
  A: 'Alpha',
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
  '9': 'Nine',
};

/** Uppercased phonetic word -> decoded character. */
const WORDS: Record<string, string> = {};
for (const [letter, word] of Object.entries(LETTERS)) {
  WORDS[word.toUpperCase()] = letter;
}
for (const [digit, word] of Object.entries(DIGITS)) {
  WORDS[word.toUpperCase()] = digit;
}

const MAX_INPUT = 100_000;

function separatorFor(value: string): string {
  if (value === 'newline') return '\n';
  if (value === 'comma') return ', ';
  return ' ';
}

function encode(text: string, separator: string, uppercase: boolean): TextRunResult {
  const tokens: string[] = [];

  for (const ch of text) {
    if (/\s/u.test(ch)) continue;

    const upperChar = ch.toUpperCase();
    const letter = LETTERS[upperChar];
    if (letter) {
      tokens.push(uppercase ? letter.toUpperCase() : letter);
      continue;
    }

    const digit = DIGITS[ch];
    if (digit) {
      tokens.push(uppercase ? digit.toUpperCase() : digit);
      continue;
    }

    // Symbols and characters outside A-Z / 0-9 are passed through untouched so
    // punctuation such as hyphens and slashes is not silently lost.
    tokens.push(ch);
  }

  if (tokens.length === 0) {
    throw new ToolError(
      'Nothing to encode: the input contains no letters, digits or symbols.',
      'Type the text you want to spell out, for example "N73AB".',
    );
  }

  const output = tokens.join(separator);
  const notes: string[] = [`${tokens.length} symbols encoded using the NATO spelling alphabet.`];

  return { output, notes };
}

function decode(text: string): TextRunResult {
  const rawTokens = text.split(/[\s,;]+/u).filter((token) => token.length > 0);
  if (rawTokens.length === 0) {
    throw new ToolError(
      'Nothing to decode: the input contains no phonetic words.',
      'Paste a sequence such as "November Seven Three Alpha Bravo".',
    );
  }

  const parts: string[] = [];
  const unknown: string[] = [];

  for (const rawToken of rawTokens) {
    const upperToken = rawToken.toUpperCase();
    const decoded = WORDS[upperToken];
    if (decoded) {
      parts.push(decoded);
      continue;
    }

    // A single character is either a literal digit/letter or punctuation, both
    // of which are meaningful in the decoded output.
    if (rawToken.length === 1) {
      parts.push(rawToken);
      continue;
    }

    unknown.push(rawToken);
    parts.push(`[${rawToken}]`);
  }

  const output = parts.join('');
  const notes: string[] = [`Decoded ${rawTokens.length} phonetic tokens into ${output.length} characters.`];
  if (unknown.length > 0) {
    notes.push(
      `Unknown word${unknown.length === 1 ? '' : 's'} kept in brackets: ${unknown.join(', ')}.`,
    );
  }

  return { output, notes };
}

const tool: TextToolModule = {
  meta,
  async run(input: TextRunInput): Promise<TextRunResult> {
    const options = resolveOptions(meta, input.options);
    const text = input.text;

    if (text.length > MAX_INPUT) {
      throw new ToolError(
        `Input is too large (${text.length.toLocaleString()} characters).`,
        `Keep the input under ${MAX_INPUT.toLocaleString()} characters.`,
      );
    }

    const direction = String(options.direction ?? 'encode');
    const separator = separatorFor(String(options.separator ?? 'space'));
    const uppercase = Boolean(options.uppercase);

    if (direction === 'decode') return decode(text);
    return encode(text, separator, uppercase);
  },
};

export default tool;
