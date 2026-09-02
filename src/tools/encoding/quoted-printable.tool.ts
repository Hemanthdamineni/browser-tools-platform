import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './quoted-printable.meta';

function decode(input: string): string {
  // Remove soft line breaks: "=" right before a CRLF/LF.
  const noSoft = input.replace(/=(\r\n|\n|\r)/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < noSoft.length; i++) {
    const ch = noSoft[i]!;
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(noSoft.slice(i + 1, i + 3))) {
      bytes.push(parseInt(noSoft.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      // push the UTF-8 bytes of this character
      for (const b of new TextEncoder().encode(ch)) bytes.push(b);
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
}

function encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let line = '';
  const lines: string[] = [];
  const pushLine = (soft: boolean) => {
    lines.push(soft ? line + '=' : line);
    line = '';
  };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === 0x0a) {
      lines.push(line);
      line = '';
      continue;
    }
    if (b === 0x0d) continue;
    let token: string;
    const printable = (b >= 0x21 && b <= 0x7e && b !== 0x3d) || b === 0x20 || b === 0x09;
    if (
      printable &&
      !((b === 0x20 || b === 0x09) && (i + 1 >= bytes.length || bytes[i + 1] === 0x0a))
    ) {
      token = String.fromCharCode(b);
    } else {
      token = '=' + b.toString(16).toUpperCase().padStart(2, '0');
    }
    if (line.length + token.length > 75) pushLine(true);
    line += token;
  }
  lines.push(line);
  return lines.join('\n');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  if (o.mode === 'encode') {
    return { output: encode(input.text), render: 'code' };
  }
  return { output: decode(input.text) };
}

const tool: TextToolModule = { meta, run };
export default tool;
