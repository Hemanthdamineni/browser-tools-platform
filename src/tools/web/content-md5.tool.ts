import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { md5 } from '../crypto/hash.tool';
import { meta } from './content-md5.meta';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
async function run(input: TextRunInput): Promise<TextRunResult> {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Content-MD5 mode.');
  const expected = String(options.digest).trim();
  const digest = toBase64(md5(new TextEncoder().encode(input.text)));
  if (mode === 'build')
    return {
      output: digest,
      render: 'code',
      language: 'http',
      filename: 'content-md5.txt',
      stats: { algorithm: 'MD5', bytes: new TextEncoder().encode(input.text).length },
    };
  if (!expected)
    return {
      output: JSON.stringify({ headers: ['Computed Content-MD5', 'Expected', 'Status'], rows: [] }),
      render: 'table',
      notes: ['Provide an expected Base64 Content-MD5 value to verify.'],
    };
  const valid = /^[A-Za-z0-9+/]{22}==$/.test(expected);
  const matches = valid && expected === digest;
  return {
    output: JSON.stringify({
      headers: ['Computed Content-MD5', 'Expected', 'Status'],
      rows: [[digest, expected, !valid ? 'Invalid' : matches ? 'Match' : 'Mismatch']],
    }),
    render: 'table',
    stats: {
      algorithm: 'MD5',
      bytes: new TextEncoder().encode(input.text).length,
      match: matches ? 'yes' : 'no',
    },
    notes: [
      'Content-MD5 is a legacy checksum, not an authenticity mechanism; prefer Content-Digest or a cryptographic signature.',
    ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
