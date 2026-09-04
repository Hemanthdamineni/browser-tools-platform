import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './meta-tags.meta';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const title = String(o.title).trim();
  const description = String(o.description).trim();
  if (!title && !description) {
    throw new ToolError('Enter at least a title or description.');
  }

  const lines: string[] = [];
  if (title) lines.push(`<title>${esc(title)}</title>`);
  if (description) lines.push(`<meta name="description" content="${esc(description)}">`);
  const canonical = String(o.canonicalUrl).trim();
  if (canonical) lines.push(`<link rel="canonical" href="${esc(canonical)}">`);

  const og: [string, string][] = [];
  if (title) og.push(['og:title', title]);
  if (description) og.push(['og:description', description]);
  if (canonical) og.push(['og:url', canonical]);
  const image = String(o.imageUrl).trim();
  if (image) og.push(['og:image', image]);
  og.push(['og:type', String(o.ogType)]);
  const siteName = String(o.siteName).trim();
  if (siteName) og.push(['og:site_name', siteName]);
  for (const [prop, val] of og) lines.push(`<meta property="${prop}" content="${esc(val)}">`);

  const tw: [string, string][] = [['twitter:card', String(o.twitterCard)]];
  if (title) tw.push(['twitter:title', title]);
  if (description) tw.push(['twitter:description', description]);
  if (image) tw.push(['twitter:image', image]);
  for (const [name, val] of tw) lines.push(`<meta name="${name}" content="${esc(val)}">`);

  return {
    output: lines.join('\n') + '\n',
    render: 'code',
    language: 'html',
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
