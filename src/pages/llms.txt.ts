import type { APIRoute } from 'astro';
import { absoluteUrl, site } from '@/lib/site';
import { VISIBLE_TOOLS, categoriesWithCounts } from '@/lib/registry';

/**
 * `llms.txt` — a machine-readable catalogue for AI crawlers (llmstxt.org shape).
 * It is a pure function of the registry, so it stays in sync as tools ship.
 * Served as `text/plain` at `/llms.txt`.
 */
export const GET: APIRoute = () => {
  const url = (path: string) => absoluteUrl(path);
  const categories = categoriesWithCounts();

  const lines: string[] = [];
  lines.push(`# ${site.name}`);
  lines.push('');
  lines.push(`> ${site.description}`);
  lines.push('');
  lines.push(
    `${site.name} is a collection of ${VISIBLE_TOOLS.length} client-side utilities across ${categories.length} categories. ` +
      `Every tool runs entirely in your browser — no uploads, no accounts, no tracking — and works offline once loaded.`,
  );
  lines.push('');

  lines.push('## Categories');
  for (const c of categories) {
    lines.push(`- [${c.name}](${url(`/categories/${c.id}`)}): ${c.blurb}`);
  }
  lines.push('');

  lines.push('## Tools');
  for (const c of categories) {
    const tools = VISIBLE_TOOLS.filter((t) => t.meta.category === c.id);
    lines.push(`### ${c.name}`);
    for (const t of tools) {
      lines.push(`- [${t.meta.name}](${url(`/tools/${t.meta.id}`)}): ${t.meta.summary}`);
    }
    lines.push('');
  }

  lines.push('## Optional');
  lines.push(
    `${site.name} respects your privacy: all processing is on-device and no data ever leaves your browser. ` +
      `For the full list and the complete catalogue, see ${url('/tools-index.json')}.`,
  );
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
