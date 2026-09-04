import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './hmac.meta';

const HASH: Record<string, string> = {
  'sha-1': 'SHA-1',
  'sha-256': 'SHA-256',
  'sha-384': 'SHA-384',
  'sha-512': 'SHA-512',
};

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i]!.toString(16).padStart(2, '0');
  return s;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);

  if (!input.text) return { output: '' };

  const key = String(o.key ?? '');
  if (!key) {
    throw new ToolError('A secret key is required.', 'Enter the shared key in the options panel.');
  }

  const algorithm = String(o.algorithm);
  const hash = HASH[algorithm];
  if (!hash) {
    throw new ToolError(
      `Unknown algorithm "${algorithm}".`,
      'Use sha-1, sha-256, sha-384 or sha-512.',
    );
  }

  if (!crypto?.subtle) throw new ToolError('Web Crypto is not available in this environment.');

  const enc = new TextEncoder();
  const keyBytes = enc.encode(key);
  const data = enc.encode(input.text);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash }, false, [
    'sign',
  ]);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));

  const out = String(o.output) === 'base64' ? toBase64(sig) : toHex(sig);

  return {
    output: out,
    render: 'code',
    stats: {
      algorithm: `HMAC-${hash}`,
      'key bytes': keyBytes.length,
      'bytes signed': data.length,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
