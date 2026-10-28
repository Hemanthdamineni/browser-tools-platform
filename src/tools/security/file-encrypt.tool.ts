import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './file-encrypt.meta';
import { decryptFile, encryptFile } from './file-encrypt.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const password = String(o.password ?? '');
  if (!password) {
    throw new ToolError('A password is required.');
  }
  const file = input.files[0];
  if (!file) {
    throw new ToolError('Choose a file first.');
  }
  const signal = input.signal;
  try {
    if (o.mode === 'decrypt') {
      const res = await decryptFile(file, password, { signal });
      return {
        outputs: [{ filename: res.filename, blob: res.file }],
        notes: ['Decrypted and integrity-checked (AES-256-GCM).'],
        stats: res.stats,
      };
    }
    const res = await encryptFile(file, password, { signal });
    return {
      outputs: [{ filename: `${file.name || 'file'}.feenc`, blob: res.container }],
      notes: [
        'Encrypted with AES-256-GCM; key derived via PBKDF2-SHA256 (600,000 iterations). Keep the passphrase safe — it cannot be recovered.',
      ],
      stats: res.stats,
    };
  } catch (err) {
    if (err instanceof ToolError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ToolError(err instanceof Error ? err.message : 'Encryption failed.');
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
