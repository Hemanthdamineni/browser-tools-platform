import type { APIRoute } from 'astro';
import { absoluteUrl, site } from '@/lib/site';
import { VISIBLE_TOOLS, categoriesWithCounts } from '@/lib/registry';
import { getContent } from '@/lib/content';
import type { ToolOption } from '@/lib/types';

/**
 * `llms-full.txt` — the complete, flat-text description of every tool so an LLM
 * can answer questions about them without crawling 400 pages. Pure function of
 * the registry. Served as `text/plain` at `/llms-full.txt`.
 */
export const GET: APIRoute = () => {
  const url = (path: string) => absoluteUrl(path);
  const categories = categoriesWithCounts();

  const optionLine = (o: ToolOption): string => {
    const detail = o.help ? ` (${o.help})` : '';
    const extra =
      o.type === 'select' ? ` — ${o.choices.map((c) => `${c.value}: ${c.label}`).join(' | ')}` : '';
    return `- \`${o.key}\` (${o.type}, default \`${o.default}\`)${extra}: ${o.label}${detail}`;
  };

  const lines: string[] = [];
  lines.push(`# ${site.name}`);
  lines.push('');
  lines.push(`> ${site.description}`);
  lines.push('');
  lines.push(
    `This document is the complete machine-readable catalogue of every ${site.name} tool. ` +
      `All ${VISIBLE_TOOLS.length} tools run entirely on-device in the browser — no uploads, no accounts, ` +
      `no tracking — and work offline once loaded. The canonical, up-to-date JSON index is ` +
      `${url('/tools-index.json')}; this page mirrors it as plain text.`,
  );
  lines.push('');

  for (const c of categories) {
    const tools = VISIBLE_TOOLS.filter((t) => t.meta.category === c.id);
    lines.push(`## ${c.name}`);
    lines.push(`[${c.name}](${url(`/categories/${c.id}`)}) — ${c.blurb}`);
    lines.push('');
    lines.push(`${tools.length} tools:`);
    lines.push('');

    for (const t of tools) {
      const meta = t.meta;
      lines.push(`### ${meta.name} (\`${meta.id}\`)`);
      lines.push(`- URL: ${url(`/tools/${meta.id}`)}`);
      lines.push(`- Category: ${c.name}`);
      lines.push(`- Status: ${meta.status ?? 'stable'}`);
      lines.push(`- Summary: ${meta.summary}`);
      lines.push(`- Description: ${meta.description}`);
      lines.push(`- Keywords: ${meta.keywords.join(', ')}`);
      lines.push(
        `- Input: ${meta.input}${meta.acceptsText ? ' (+ typed text)' : ''}${meta.panel ? ` (custom panel: ${meta.panel})` : ''}${meta.camera ? ' (camera capture)' : ''}`,
      );
      lines.push(
        `- Privacy: ${meta.privacy.processing}; network: ${Array.isArray(meta.privacy.network) ? meta.privacy.network.join(', ') : meta.privacy.network}; offline: ${meta.privacy.offline}`,
      );
      if (meta.options?.length) {
        lines.push('- Options:');
        for (const o of meta.options) lines.push(optionLine(o));
      }
      if (meta.examples?.length) {
        lines.push('- Examples:');
        for (const ex of meta.examples) {
          lines.push(
            `  - ${ex.title}${ex.input != null ? ` — input: ${JSON.stringify(ex.input)}` : ''}`,
          );
        }
      }
      const content = getContent(meta.id);
      if (content?.article?.length) {
        lines.push('- How it works:');
        for (const a of content.article) {
          lines.push(`  - ${a.heading}: ${a.body}`);
        }
      }
      if (content?.faq?.length) {
        lines.push('- FAQ:');
        for (const f of content.faq) {
          lines.push(`  - Q: ${f.q}`);
          lines.push(`    A: ${f.a}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('## Optional');
  lines.push(
    `All ${site.name} tools are free and privacy-first. None require an account and none send your data ` +
      `anywhere. For the privacy model and how tools handle files, see ${url('/privacy')}.`,
  );
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
