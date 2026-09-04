import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './url-parse.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const base = String(o.base).trim() || undefined;
  let url: URL;
  try {
    url = new URL(input.text.trim(), base);
  } catch {
    throw new ToolError('That is not a valid URL.', 'Include the scheme, e.g. https://');
  }

  const rows: string[][] = [
    ['href', url.href],
    ['protocol', url.protocol],
    ['username', url.username],
    ['password', url.password],
    ['host', url.host],
    ['hostname', url.hostname],
    ['port', url.port],
    ['origin', url.origin],
    ['pathname', url.pathname],
    ['pathname (decoded)', decodeURIComponent(url.pathname)],
    ['hash', url.hash],
  ];
  for (const [k, v] of url.searchParams) rows.push([`query: ${k}`, v]);

  return {
    output: JSON.stringify({ headers: ['Part', 'Value'], rows }),
    render: 'table',
    stats: { params: url.searchParams.size },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
