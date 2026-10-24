import type { APIRoute } from 'astro';
import { VISIBLE_TOOLS } from '@/lib/registry';
import { site } from '@/lib/site';
import { CATEGORIES } from '@/lib/categories';
import type { ToolOption } from '@/lib/types';

const toolUrl = (path: string) => new URL(path, site.url).toString();

const serializeOption = (o: ToolOption) => ({
  key: o.key,
  label: o.label,
  type: o.type,
  default: o.default,
  ...(o.help ? { help: o.help } : {}),
});

/**
 * Machine-readable catalogue: used by e2e tests and available to integrators.
 * Keeps the original flat keys (`id`, `name`, `category`, `href`, `input`,
 * `privacy`, `hasExamples`) and adds the full, rich fields an LLM or integrator
 * needs to understand every tool without visiting each page.
 */
export const GET: APIRoute = () => {
  const body = VISIBLE_TOOLS.map((t) => {
    const meta = t.meta;
    return {
      id: meta.id,
      name: meta.name,
      category: meta.category,
      categoryName: CATEGORIES[meta.category].name,
      href: `/tools/${meta.id}`,
      input: meta.input,
      privacy: meta.privacy,
      hasExamples: (meta.examples?.length ?? 0) > 0,
      url: toolUrl(`/tools/${meta.id}`),
      summary: meta.summary,
      description: meta.description,
      keywords: meta.keywords,
      status: meta.status ?? 'stable',
      options: (meta.options ?? []).map(serializeOption),
      examples: (meta.examples ?? []).map((e) => ({ title: e.title, input: e.input ?? '' })),
      faq: (meta.faq ?? []).map((f) => ({ question: f.q, answer: f.a })),
    };
  });

  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};