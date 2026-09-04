import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './data-uri.meta';

const encode64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const decode64 = (s: string) => decodeURIComponent(escape(atob(s)));

const TEXTUAL = /^(text\/|application\/(json|xml|javascript|xhtml\+xml)$|image\/svg\+xml$)/;

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  if (o.mode === 'encode') {
    if (!input.text) return { output: '' };
    const mime = String(o.mimeType).trim() || 'text/plain';
    const charset = o.charset ? ';charset=utf-8' : '';
    const payload = o.encoding === 'url' ? encodeURIComponent(input.text) : encode64(input.text);
    const marker = o.encoding === 'url' ? '' : ';base64';
    return { output: `data:${mime}${charset}${marker},${payload}`, render: 'text' };
  }

  // decode
  const text = input.text.trim();
  if (!text) return { output: '' };
  const m = /^data:([^;,]*)((?:;[^;,]+)*?)(;base64)?,(.*)$/s.exec(text);
  if (!m) throw new ToolError('Not a data: URI.');
  const mime = m[1] || 'text/plain';
  const params = (m[2] ?? '').split(';').filter((p) => p && p !== 'base64');
  const isBase64 = Boolean(m[3]);
  const payload = m[4] ?? '';
  let decoded: string;
  try {
    decoded = isBase64 ? decode64(payload) : decodeURIComponent(payload);
  } catch {
    throw new ToolError(
      'The payload could not be decoded.',
      isBase64 ? 'Malformed base64.' : 'Malformed percent-escaping.',
    );
  }
  const bytes = isBase64 ? atob(payload).length : new TextEncoder().encode(payload).length;
  const notes: string[] = [];
  if (!TEXTUAL.test(mime) && !mime.startsWith('text/')) {
    notes.push(`binary payload, ${bytes} bytes`);
  }
  return {
    output: decoded,
    render: 'text',
    notes: notes.length ? notes : undefined,
    stats: {
      'MIME type': mime,
      Parameters: params.join(', ') || 'none',
      Encoding: isBase64 ? 'base64' : 'percent',
      bytes,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
