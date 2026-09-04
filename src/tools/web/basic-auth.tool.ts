import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './basic-auth.meta';

/** UTF-8-safe atob / btoa. */
const encode64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const decode64 = (s: string) => decodeURIComponent(escape(atob(s)));

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  if (o.mode === 'build') {
    const user = String(o.username);
    const pass = String(o.password);
    const token = encode64(`${user}:${pass}`);
    return {
      output: `Authorization: Basic ${token}`,
      render: 'code',
      language: 'http',
      warnings:
        !user && !pass
          ? ['No username or password entered — the token encodes an empty pair.']
          : undefined,
    };
  }

  // decode
  let text = input.text.trim();
  if (!text) return { output: '' };
  text = text
    .replace(/^Authorization\s*:\s*/i, '')
    .replace(/^Basic\s+/i, '')
    .trim();
  let decoded: string;
  try {
    decoded = decode64(text);
  } catch {
    throw new ToolError('That is not valid base64.');
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) {
    throw new ToolError('No colon found — a Basic token is "username:password" before encoding.');
  }
  return {
    output: `Username: ${decoded.slice(0, sep)}\nPassword: ${decoded.slice(sep + 1)}`,
    render: 'text',
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
