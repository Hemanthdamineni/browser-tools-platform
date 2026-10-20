import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ansi-sequences.meta';

type Sequence = {
  start: number;
  end: number;
  raw: string;
  kind: 'CSI' | 'OSC';
  body: string;
  final: string;
};
type Token = { start: number; end: number; sequence?: Sequence };

function scan(text: string): { tokens: Token[]; malformed: number } {
  const tokens: Token[] = [];
  let malformed = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== 0x1b) continue;
    const next = text[i + 1];
    if (next === '[') {
      let j = i + 2;
      while (j < text.length && text.charCodeAt(j) >= 0x30 && text.charCodeAt(j) <= 0x3f) j++;
      while (j < text.length && text.charCodeAt(j) >= 0x20 && text.charCodeAt(j) <= 0x2f) j++;
      if (j < text.length && text.charCodeAt(j) >= 0x40 && text.charCodeAt(j) <= 0x7e) {
        const sequence: Sequence = {
          start: i,
          end: j + 1,
          raw: text.slice(i, j + 1),
          kind: 'CSI',
          body: text.slice(i + 2, j),
          final: text[j]!,
        };
        tokens.push({ start: i, end: j + 1, sequence });
        i = j;
      } else {
        tokens.push({ start: i, end: i + 1 });
        malformed++;
      }
    } else if (next === ']') {
      let j = i + 2;
      let terminator = '';
      while (j < text.length) {
        if (text.charCodeAt(j) === 0x07) {
          terminator = 'BEL';
          break;
        }
        if (text.charCodeAt(j) === 0x1b && text[j + 1] === '\\') {
          terminator = 'ST';
          break;
        }
        j++;
      }
      if (terminator) {
        const end = terminator === 'BEL' ? j + 1 : j + 2;
        const sequence: Sequence = {
          start: i,
          end,
          raw: text.slice(i, end),
          kind: 'OSC',
          body: text.slice(i + 2, j),
          final: terminator,
        };
        tokens.push({ start: i, end, sequence });
        i = end - 1;
      } else {
        tokens.push({ start: i, end: i + 1 });
        malformed++;
      }
    } else {
      tokens.push({ start: i, end: i + 1 });
      malformed++;
    }
  }
  return { tokens, malformed };
}

function label(sequence: Sequence): string {
  if (sequence.kind === 'OSC') {
    const command = sequence.body.split(';', 1)[0] || 'empty';
    return `[OSC ${command}; … (${sequence.final})]`;
  }
  if (sequence.final === 'm') return `[SGR ${sequence.body || '0'}]`;
  const names: Record<string, string> = {
    A: 'cursor up',
    B: 'cursor down',
    C: 'cursor forward',
    D: 'cursor back',
    H: 'cursor position',
    f: 'cursor position',
    J: 'erase display',
    K: 'erase line',
    s: 'save cursor',
    u: 'restore cursor',
  };
  return `[CSI ${sequence.body}${sequence.final}${names[sequence.final] ? `: ${names[sequence.final]}` : ''}]`;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const operation = String(options.operation);
  if (!['strip', 'visualize', 'analyze'].includes(operation))
    throw new ToolError('Choose a valid operation.');
  const { tokens, malformed } = scan(input.text);
  const sequences = tokens.flatMap((token) => (token.sequence ? [token.sequence] : []));

  if (operation === 'analyze') {
    const rows = sequences.map((sequence) => [
      String(sequence.start),
      sequence.kind,
      sequence.kind === 'CSI' && sequence.final === 'm' ? 'SGR styling' : sequence.kind,
      label(sequence),
      sequence.raw,
    ]);
    const output = JSON.stringify({
      headers: ['Offset', 'Type', 'Category', 'Readable form', 'Raw sequence'],
      rows,
    });
    return {
      output,
      render: 'table',
      stats: { sequences: sequences.length, malformed },
      notes: malformed
        ? [`${malformed} incomplete or unsupported ESC sequence(s) were left untouched.`]
        : undefined,
    };
  }

  let output = '';
  let cursor = 0;
  for (const token of tokens) {
    output += input.text.slice(cursor, token.start);
    output += token.sequence
      ? operation === 'strip'
        ? ''
        : label(token.sequence)
      : input.text.slice(token.start, token.end);
    cursor = token.end;
  }
  output += input.text.slice(cursor);
  return {
    output,
    render: 'code',
    stats: {
      sequences: sequences.length,
      malformed,
      'input characters': input.text.length,
      'output characters': output.length,
    },
    notes: malformed
      ? [`${malformed} incomplete or unsupported ESC sequence(s) were left untouched.`]
      : undefined,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
