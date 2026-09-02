import type { APIRoute } from 'astro';
import { site } from '@/lib/site';

export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${site.shortName}</ShortName>
  <Description>Search ${site.name} tools</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="text/html" method="get" template="${site.url}/tools?q={searchTerms}"/>
  <moz:SearchForm xmlns:moz="http://www.mozilla.org/2006/browser/search/">${site.url}/tools</moz:SearchForm>
</OpenSearchDescription>
`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/opensearchdescription+xml; charset=utf-8' },
  });
};
