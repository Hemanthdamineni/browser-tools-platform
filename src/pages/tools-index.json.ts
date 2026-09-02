import type { APIRoute } from 'astro';
import { VISIBLE_TOOLS } from '@/lib/registry';

/** Machine-readable catalogue: used by e2e tests and available to integrators. */
export const GET: APIRoute = () => {
  const body = VISIBLE_TOOLS.map((t) => ({
    id: t.meta.id,
    name: t.meta.name,
    category: t.meta.category,
    input: t.meta.input,
    privacy: t.meta.privacy,
    href: `/tools/${t.meta.id}`,
    hasExamples: (t.meta.examples?.length ?? 0) > 0,
  }));
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
