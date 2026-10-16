import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './repr-digest.meta';

function toBase64(bytes: Uint8Array): string { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
async function digest(text: string): Promise<string> { const bytes = new TextEncoder().encode(text); const hash = await crypto.subtle.digest('SHA-256', bytes); return `sha-256=:${toBase64(new Uint8Array(hash))}:`; }
function valid(value: string): boolean { return /^sha-256=:[A-Za-z0-9+/]{43}=:$/u.test(value); }
async function run(input: TextRunInput): Promise<TextRunResult> { const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Repr-Digest mode.'); const computed = await digest(input.text); if (mode === 'build') return { output: computed, render: 'code', language: 'http', filename: 'repr-digest.txt', stats: { algorithm: 'sha-256', bytes: new TextEncoder().encode(input.text).length } }; const expected = String(options.digest).trim(); if (!expected) return { output: JSON.stringify({ headers: ['Computed Repr-Digest', 'Expected', 'Status'], rows: [] }), render: 'table', notes: ['Provide an expected Repr-Digest value to verify.'] }; const matches = valid(expected) && expected === computed; return { output: JSON.stringify({ headers: ['Computed Repr-Digest', 'Expected', 'Status'], rows: [[computed, expected, !valid(expected) ? 'Invalid' : matches ? 'Match' : 'Mismatch']] }), render: 'table', stats: { algorithm: 'sha-256', bytes: new TextEncoder().encode(input.text).length, match: matches ? 'yes' : 'no' }, notes: ['Repr-Digest identifies representation bytes; it does not authenticate the producer.'] }; }
const tool: TextToolModule = { meta, run };
export default tool;
