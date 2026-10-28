import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './placeholder-svg.meta';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isHex = (s: string) => /^#[0-9a-fA-F]{3,8}$/.test(s.trim());

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const width = Math.max(16, Math.floor(Number(o.width ?? 600)));
  const height = Math.max(16, Math.floor(Number(o.height ?? 400)));
  if (
    Number(o.width) < 16 ||
    Number(o.height) < 16
  ) {
    throw new ToolError('Width and height must be at least 16.');
  }
  const bg = String(o.bg ?? '#e2e8f0').trim();
  const fg = String(o.fg ?? '#64748b').trim();
  for (const c of [bg, fg]) {
    if (!isHex(c)) throw new ToolError(`"${c}" is not a hex colour.`, 'Use #rgb or #rrggbb.');
  }
  const label = String(o.label ?? '').trim() || `${width}×${height}`;
  const fontSize =
    Math.floor(Number(o.fontSize ?? 0)) || Math.max(8, Math.round(Math.min(width, height) / 6));

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${bg}"/>` +
    `<text x="50%" y="50%" fill="${fg}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>` +
    `</svg>`;

  return {
    output: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
    render: 'image',
    filename: 'placeholder.svg',
    stats: { size: `${width} × ${height}`, bytes: svg.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
