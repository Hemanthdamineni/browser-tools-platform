import { describe, expect, it, vi } from 'vitest';
import tool from './pgp-tool.tool';
import { ToolError } from '@/lib/types';

type Result = {
  outputs?: Array<{ filename: string; blob: Blob }>;
  report?: { output: string; render?: string };
  warnings?: string[];
  stats?: Record<string, string | number>;
};

const run = async (text: string, options: Record<string, string | number | boolean> = {}, files: File[] = []) =>
  (await tool.run({ text, options, files, signal: new AbortController().signal, onProgress: vi.fn() })) as Result;

describe('pgp-tool', () => {
  it('rejects generate without name', async () => {
    await expect(run('', { mode: 'generate', userEmail: 'alice@example.com' })).rejects.toThrow('Name is required');
  });

  it('rejects generate with invalid email', async () => {
    await expect(run('', { mode: 'generate', userName: 'Alice', userEmail: 'invalid' })).rejects.toThrow('Email is not valid');
  });

  it('rejects encrypt without public key', async () => {
    await expect(run('Hello', { mode: 'encrypt' })).rejects.toThrow('Public key is required');
  });

  it('rejects decrypt without private key', async () => {
    await expect(run('message', { mode: 'decrypt' })).rejects.toThrow('Private key is required');
  });

  it('rejects sign without private key', async () => {
    await expect(run('doc', { mode: 'sign' })).rejects.toThrow('Private key is required');
  });

  it('rejects verify without public key', async () => {
    await expect(run('doc', { mode: 'verify' })).rejects.toThrow('Public key is required');
  });

  it('rejects export without private key', async () => {
    await expect(run('', { mode: 'export' })).rejects.toThrow('Private key is required');
  });
});