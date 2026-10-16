import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './via-header.meta';

const PROTO_RE = /^([A-Za-z0-9+.-]+(?:\/[A-Za-z0-9+.-]+)?)(?:\s+([A-Za-z0-9.-]+))?(?:\s*\([^)]*\))?$/;
function splitElements(text: string): string[] {
  const elements: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')' && depth > 0) depth--;
    if (char === ',' && depth === 0) { elements.push(current.trim()); current = ''; } else { current += char; }
  }
  if (current.trim()) elements.push(current.trim());
  return elements;
}
function analyze(input: TextRunInput): TextRunResult {
  const value = input.text.trim();
  if (!value) return { output: JSON.stringify({ headers: ['Element', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste a Via header value to analyze, or use Build mode.'] };
  const elements = splitElements(value);
  const rows = elements.map((element) => {
    const match = PROTO_RE.exec(element);
    if (!match || !match[2]) return [element, 'Invalid', !match ? 'Not valid RFC 7230 grammar' : 'Missing received-by (host) after protocol/version'];
    const host = match[2];
    return [element, 'Valid', `Protocol/version ${match[1]} received by ${host}`];
  });
  const invalid = rows.filter((row) => row[1] === 'Invalid').length;
  const notes: string[] = [];
  if (invalid) notes.push(`${invalid} element(s) did not match RFC 7230 grammar.`);
  else if (elements.length) notes.push('Every element matches RFC 7230: protocol-name/protocol-version[ received-by[[ comment]]].');
  if (elements.length > 1) notes.push(`${elements.length} proxy chain element(s) — each hop adds one Via element, ordered request-side to response-side.`);
  return { output: JSON.stringify({ headers: ['Element', 'Status', 'Assessment'], rows }), render: 'table', stats: { elements: elements.length, invalid }, notes };
}
function build(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const protocol = String(options.protocol).trim();
  const host = String(options.host).trim();
  const versionMatch = /([0-9]+(?:\.[0-9]+)?)/.exec(protocol);
  if (!versionMatch) throw new ToolError('Protocol version is required (e.g. HTTP/1.1 or 1.1).');
  const protocolFragment = protocol.includes('/') ? protocol : `HTTP/${versionMatch[1]}`;
  if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new ToolError('Host must be a valid reg-name or host token.');
  const output = `${protocolFragment} ${host}`;
  return { output, render: 'code', language: 'http', filename: 'via-header.txt', stats: { gateways: 1, protocol: protocolFragment, host } };
}
function run(input: TextRunInput): TextRunResult { const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode === 'build') return build(input); if (mode !== 'analyze') throw new ToolError('Choose a supported mode.'); return analyze(input); }
const tool: TextToolModule = { meta, run };
export default tool;
