import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './curl-to-fetch.meta';

/** Split a curl command into shell-like tokens, honoring quotes and continuations. */
function tokenize(source: string): string[] {
  const tokens: string[] = [];
  const normalized = source.replace(/\\\r?\n/g, ' ');
  let cur = '';
  let quote: "'" | '"' | null = null;
  let started = false;

  const push = (): void => {
    if (cur !== '') tokens.push(cur);
    cur = '';
    started = false;
  };

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]!;
    if (quote === '"') {
      if (ch === '\\') {
        const next = normalized[i + 1];
        cur += next === undefined ? '\\' : next;
        i += 1;
      } else if (ch === '"') quote = null;
      else cur += ch;
      continue;
    }
    if (quote === "'") {
      if (ch === "'") quote = null;
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      push();
      continue;
    }
    if (ch === '\\') {
      const next = normalized[i + 1];
      cur += next === undefined ? '\\' : next;
      i += 1;
      started = true;
      continue;
    }
    if (ch === '#' && !started) {
      // Unquoted comment to end of line/block.
      while (normalized[i] !== undefined && normalized[i] !== '\n') i += 1;
      continue;
    }
    cur += ch;
    started = true;
  }
  push();
  return tokens;
}

function isJsonBody(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

function formatJsonForBody(text: string, pretty: boolean): string {
  const parsed = JSON.parse(text) as unknown;
  return JSON.stringify(parsed, null, pretty ? 2 : 0);
}

interface Parsed {
  url: string;
  method: string;
  headers: Array<[string, string]>;
  data: string | null;
  dataUrlEncoded: boolean;
  form: Array<[string, string]>;
  auth: string | null;
  notes: string[];
}

function parseCmd(source: string): Parsed {
  const tokens = tokenize(source);
  if (!tokens.length)
    throw new ToolError('Paste a curl command to convert.', 'It usually starts with "curl …".');
  let url = '';
  let method = '';
  const headers: Array<[string, string]> = [];
  let data: string | null = null;
  let dataUrlEncoded = false;
  const form: Array<[string, string]> = [];
  let auth: string | null = null;
  const notes: string[] = [];

  let i = 0;
  if (tokens[0]!.toLowerCase() === 'curl') i = 1;
  while (i < tokens.length) {
    const token = tokens[i]!;
    const next = tokens[i + 1];

    if (token === '-X' || token === '--request') {
      method = (next ?? '').toUpperCase();
      i += 2;
      continue;
    }
    if (token === '-H' || token === '--header') {
      const header = next ?? '';
      const colon = header.indexOf(':');
      if (colon > 0) headers.push([header.slice(0, colon).trim(), header.slice(colon + 1).trim()]);
      else notes.push(`Ignored header without a colon: ${header}`);
      i += 2;
      continue;
    }
    if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary'
    ) {
      data = next ?? '';
      i += 2;
      continue;
    }
    if (token === '--data-urlencode') {
      data = next ?? '';
      dataUrlEncoded = true;
      i += 2;
      continue;
    }
    if (token === '-F' || token === '--form') {
      const field = next ?? '';
      const eq = field.indexOf('=');
      if (eq > 0) form.push([field.slice(0, eq).trim(), field.slice(eq + 1).trim()]);
      i += 2;
      continue;
    }
    if (token === '--url') {
      url = next ?? '';
      i += 2;
      continue;
    }
    if (token === '-u' || token === '--user') {
      auth = next ?? '';
      i += 2;
      continue;
    }
    if (token === '-b' || token === '--cookie') {
      const cookie = next ?? '';
      headers.push(['Cookie', cookie.startsWith(' ') ? cookie : cookie]);
      i += 2;
      continue;
    }
    if (token === '-A' || token === '--user-agent') {
      headers.push(['User-Agent', next ?? '']);
      i += 2;
      continue;
    }
    if (token === '-e' || token === '--referer') {
      headers.push(['Referer', next ?? '']);
      i += 2;
      continue;
    }
    if (token === '-G') {
      dataUrlEncoded = true;
      i += 1;
      continue;
    }
    if (token === '-I' || token === '--head') {
      method = 'HEAD';
      i += 1;
      continue;
    }
    if (token === '-L' || token === '--location')
      notes.push('Follows redirects (-L); the snippet does not loop on redirects.');
    if (token === '-k' || token === '--insecure')
      notes.push('TLS verification is off (-k); re-enable it where possible.');
    if (token === '--compressed')
      notes.push('--compressed asks the server for gzip; fetch/axios handle this automatically.');
    if (token === '-o' || token === '-c' || token === '--cookie-jar') {
      notes.push(
        `Ignored file flag "${token}" — responses are not written to disk in browser code.`,
      );
      i += 2;
      continue;
    }
    if (
      token === '--connect-timeout' ||
      token === '--max-time' ||
      token === '-x' ||
      token === '--proxy' ||
      token === '--interface'
    ) {
      notes.push(`Ignored transport flag "${token}" — not portable to client-side code.`);
      i += 2;
      continue;
    }
    if (
      token === '-s' ||
      token === '--silent' ||
      token === '-v' ||
      token === '--verbose' ||
      token === '--no-buffer'
    ) {
      i += 1;
      continue;
    }
    if (!url && !token.startsWith('-')) {
      url = token;
      i += 1;
      continue;
    }
    notes.push(`Ignored unknown token: ${token}`);
    i += 1;
  }

  if (!url)
    throw new ToolError(
      'No URL found in the command.',
      'Add a URL like "https://example.com/api" or use --url.',
    );
  if (!method) {
    if (data !== null || form.length) method = 'POST';
    else if (headers.some(([k]) => k.toLowerCase() === 'content-type')) method = 'POST';
    else method = 'GET';
  }
  if (dataUrlEncoded && data === null) {
    // -G with no data
    data = '';
  }
  return { url, method, headers, data, dataUrlEncoded, form, auth, notes };
}

function basicAuth(token: string): string {
  const bytes = new TextEncoder().encode(token);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return 'Basic ' + btoa(binary);
}

function hasHeader(headers: Array<[string, string]>, name: string): boolean {
  const lower = name.toLowerCase();
  return headers.some(([k]) => k.toLowerCase() === lower);
}

function quotedJs(value: string): string {
  return (
    "'" +
    value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    "'"
  );
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const target = String(o.target ?? 'fetch');
  const pretty = o.prettyBody !== false;
  const checkStatus = o.checkStatus !== false;
  const source = input.text ?? '';
  if (!source.trim()) {
    throw new ToolError(
      'Paste a curl command to convert.',
      'Example: curl https://example.com/api',
    );
  }
  if (source.length > 100_000) {
    throw new ToolError('Command is too large.', 'Keep it under 100,000 characters.');
  }

  const parsed = parseCmd(source);
  const lines: string[] = [];
  const jsonBody = parsed.data !== null && !parsed.dataUrlEncoded && isJsonBody(parsed.data);

  const finalHeaders: Array<[string, string]> = [...parsed.headers];
  if (parsed.auth && !hasHeader(finalHeaders, 'Authorization')) {
    finalHeaders.push(['Authorization', basicAuth(parsed.auth)]);
  }
  if (jsonBody && !hasHeader(finalHeaders, 'Content-Type')) {
    finalHeaders.push(['Content-Type', 'application/json']);
  }
  if (parsed.form.length && !hasHeader(finalHeaders, 'Content-Type')) {
    finalHeaders.push(['Content-Type', 'application/x-www-form-urlencoded']);
  }

  const headersObj = finalHeaders.length
    ? '  headers: {\n' +
      finalHeaders.map(([k, v]) => `    ${quotedJs(k)}: ${quotedJs(v)}`).join(',\n') +
      ',\n  },\n'
    : '';

  const bodyKind = parsed.form.length
    ? 'form'
    : jsonBody
      ? 'json'
      : parsed.data !== null && parsed.data !== ''
        ? 'raw'
        : null;

  const fmtFormJs = (): string =>
    `new URLSearchParams(${JSON.stringify(Object.fromEntries(parsed.form))})`;
  const fmtHeadersPy = (): string => JSON.stringify(Object.fromEntries(finalHeaders), null, 2);

  if (target === 'requests') {
    // Python requests — declare the payload first so the call can reference it.
    if (bodyKind === 'json')
      lines.push('JSON_BODY = ' + formatJsonForBody(parsed.data as string, pretty));
    else if (bodyKind === 'raw') lines.push(`DATA_STR = ${JSON.stringify(parsed.data)}`);
    lines.push('', 'import requests', '', 'response = requests.request(');
    lines.push(`    '${parsed.method}',`);
    lines.push(`    ${JSON.stringify(parsed.url)},`);
    if (finalHeaders.length) lines.push('    headers=' + fmtHeadersPy());
    if (bodyKind === 'json') lines.push('    json=JSON_BODY,');
    else if (bodyKind === 'raw') lines.push('    data=DATA_STR,');
    lines.push(')', '');
  } else if (target === 'axios') {
    lines.push('const response = await axios.request({');
    lines.push(`  method: '${parsed.method}',`);
    lines.push(`  url: ${quotedJs(parsed.url)},`);
    if (headersObj) lines.push(headersObj.trimEnd() + ',');
    if (bodyKind === 'json')
      lines.push(`  data: ${formatJsonForBody(parsed.data as string, pretty)},`);
    else if (bodyKind === 'raw') lines.push(`  data: ${quotedJs(parsed.data as string)},`);
    else if (bodyKind === 'form') lines.push('  data: ' + fmtFormJs() + ',');
    lines.push('});');
    lines.push('', '// Use response.data for the parsed body.');
  } else {
    // fetch
    lines.push(`const response = await fetch(${quotedJs(parsed.url)}, {`);
    lines.push(`  method: '${parsed.method}',`);
    if (headersObj) lines.push(headersObj.trimEnd() + ',');
    if (bodyKind === 'json')
      lines.push(`  body: JSON.stringify(${formatJsonForBody(parsed.data as string, pretty)}),`);
    else if (bodyKind === 'raw') lines.push(`  body: ${quotedJs(parsed.data as string)},`);
    else if (bodyKind === 'form') lines.push('  body: ' + fmtFormJs() + ',');
    lines.push('});');
    if (checkStatus)
      lines.push(
        'if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);',
      );
    lines.push('const data = await response.json();');
  }

  if (checkStatus && target !== 'fetch') {
    lines.push('', '// Remove the trailing status check if you prefer raw access.');
  }

  const notes = [...parsed.notes];
  const stats: Record<string, number> = { headers: finalHeaders.length };
  const output = lines.join('\n') + '\n';
  return {
    output,
    render: 'code',
    language: target === 'requests' ? 'python' : 'javascript',
    stats,
    notes: notes.length ? notes : [`Generated ${target} code for a ${parsed.method} request.`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
