import type { APIRoute } from 'astro';
import { VISIBLE_TOOLS } from '@/lib/registry';
import { absoluteUrl } from '@/lib/site';
import { getContent } from '@/lib/content';
import { CATEGORIES } from '@/lib/categories';
import type { ToolOption } from '@/lib/types';

const toolUrl = (path: string) => absoluteUrl(path);

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
      href: `${import.meta.env.BASE_URL.replace(/\/$/, '')}/tools/${meta.id}`,
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
      ...(getContent(meta.id)?.article?.length ? { article: getContent(meta.id)!.article } : {}),
      faq: (getContent(meta.id)?.faq ?? []).map((f) => ({ question: f.q, answer: f.a })),
    };
  });

  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
