import type { APIRoute } from 'astro';
import { site } from '@/lib/site';
import { VISIBLE_TOOLS, categoriesWithCounts } from '@/lib/registry';

export const GET: APIRoute = () => {
  const staticPaths = ['/', '/tools', '/categories', '/privacy', '/about'];
  const categoryPaths = categoriesWithCounts().map((c) => `/categories/${c.id}`);
  const toolPaths = VISIBLE_TOOLS.map((t) => `/tools/${t.meta.id}`);

  const urls = [...staticPaths, ...categoryPaths, ...toolPaths].map((path) => {
    const loc = new URL(path, site.url).toString();
    const priority = path === '/' ? '1.0' : path.startsWith('/tools/') ? '0.8' : '0.6';
    return `  <url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
