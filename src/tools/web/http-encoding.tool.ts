import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './http-encoding.meta';

type Coding = { name: string; q: number; raw: string; issues: string[] };
const TOKEN = /^[a-z0-9!*_-]+$/i;
function parse(text: string): Coding[] {
  return text
    .split(',')
    .map((raw) => {
      const parts = raw
        .trim()
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
      const name = (parts.shift() ?? '').toLowerCase();
      const issues: string[] = [];
      if (!TOKEN.test(name)) issues.push('Invalid coding token');
      let q = 1;
      for (const part of parts) {
        const match = /^q\s*=\s*(\d(?:\.\d{1,3})?)$/i.exec(part);
        if (!match) {
          issues.push(`Invalid parameter: ${part}`);
          continue;
        }
        q = Number(match[1]);
        if (q > 1) issues.push('q must be between 0 and 1');
      }
      return { name, q, raw: raw.trim(), issues };
    })
    .filter((coding) => coding.name.length > 0);
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported encoding mode.');
  if (mode === 'build') {
    const header = String(options.header);
    const codings = String(options.codings)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!['accept', 'content'].includes(header) || !codings.length)
      throw new ToolError('Choose a header and at least one coding.');
    if (codings.some((coding) => !TOKEN.test(coding)))
      throw new ToolError('Codings must be tokens such as br, gzip, deflate, identity, or *.');
    const output = codings.join(', ');
    return {
      output,
      render: 'code',
      language: 'http',
      filename: 'encoding-header.txt',
      stats: {
        header: header === 'accept' ? 'Accept-Encoding' : 'Content-Encoding',
        codings: codings.length,
      },
    };
  }
  const values = input.text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!values.length)
    return {
      output: JSON.stringify({ headers: ['Coding', 'q', 'Preference', 'Issues'], rows: [] }),
      render: 'table',
      notes: ['Paste an Accept-Encoding value to analyze.'],
    };
  const supported = new Set(
    String(options.supported)
      .toLowerCase()
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const all = values.flatMap(parse);
  const bestByLine = values.map((line) => {
    const codings = parse(line);
    return (
      [...codings]
        .filter(
          (coding) =>
            coding.q > 0 &&
            (supported.has(coding.name) || (coding.name === '*' && supported.size > 0)),
        )
        .sort((a, b) => b.q - a.q)[0]?.name ?? 'none'
    );
  });
  const rows = all.map((coding) => [
    coding.name,
    String(coding.q),
    bestByLine.join(', '),
    coding.issues.join('; '),
  ]);
  return {
    output: JSON.stringify({ headers: ['Coding', 'q', 'Preference', 'Issues'], rows }),
    render: 'table',
    stats: {
      codings: all.length,
      invalid: all.filter((coding) => coding.issues.length).length,
      preferred: bestByLine[0] ?? 'none',
    },
    notes: [
      'Negotiation depends on the server-supported set and response policy; no body is compressed or sent.',
    ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
