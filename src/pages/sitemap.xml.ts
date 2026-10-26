import type { APIRoute } from 'astro';
import { absoluteUrl } from '@/lib/site';
import { VISIBLE_TOOLS, categoriesWithCounts } from '@/lib/registry';
import { GUIDES } from '@/lib/guides';

/** Only a real ISO `YYYY-MM-DD` `updated` date earns a `<lastmod>`; never invent one. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = () => {
  const staticPaths = ['/', '/tools', '/categories', '/privacy', '/about', '/guides'];
  const categoryPaths = categoriesWithCounts().map((c) => `/categories/${c.id}`);
  const guidePaths = GUIDES.map((g) => g.path);

  const entries: { path: string; lastmod?: string }[] = [
    ...[...staticPaths, ...categoryPaths, ...guidePaths].map((path) => ({ path })),
    ...VISIBLE_TOOLS.map((t) => ({ path: `/tools/${t.meta.id}`, lastmod: t.meta.updated })),
  ];

  const urls = entries.map(({ path, lastmod }) => {
    const loc = absoluteUrl(path);
    const priority = path === '/' ? '1.0' : path.startsWith('/tools/') ? '0.8' : '0.6';
    const lastmodTag = lastmod && ISO_DATE.test(lastmod) ? `<lastmod>${lastmod}</lastmod>` : '';
    return `  <url><loc>${loc}</loc>${lastmodTag}<changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
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
