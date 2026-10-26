/**
 * Editorial content for the robots-txt tool page.
 *
 * Kept out of ``robots-txt.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Pick a preset or write your own',
      body: 'Allow everything produces the permissive "User-agent: * / Allow: /"; block everything is the mirror image; block AI crawlers emits a per-user-agent Disallow: / for GPTBot, ChatGPT-User, CCBot, Google-Extended, anthropic-ai, ClaudeBot, PerplexityBot, Bytespider, Amazonbot and FacebookBot, then an Allow: / for everyone else. Custom drops you into the user-agent, allow and disallow fields.',
    },
    {
      heading: 'The custom section and optional lines',
      body: 'In custom mode each comma-separated user-agent becomes its own block carrying the same Allow and Disallow paths, written disallow first because robots.txt is read top to bottom and the longest, most specific rule wins. Crawl-delay asks polite crawlers to wait between requests, and Sitemap adds a URL search engines can follow to discover pages.',
    },
    {
      heading: 'What robots.txt can and cannot do',
      body: 'It is a request, not an enforced boundary: it signals well-behaved crawlers not to fetch your site, but an operator who ignores the file is not bound by it, and humans and scraper networks are outside its reach. It also does nothing to stop a search engine indexing a URL it was told not to fetch \u2014 for real exclusion use noindex tags or HTTP auth alongside it.',
    },
    {
      heading: 'Generated locally, no requests made',
      body: 'The file is assembled in this tab from the options you choose. Nothing is fetched, no crawler is contacted and no site is probed, so you can draft rules for a staging or unreleased domain without signalling it anywhere.',
    },
  ],
  faq: [
    {
      q: 'Does blocking AI crawlers really keep my content out of training sets?',
      a: 'It signals polite crawlers (GPTBot, CCBot, ClaudeBot, …) not to fetch your site. It cannot bind operators who ignore robots.txt, and it does nothing against humans or scraper networks that ignore it.',
    },
    {
      q: 'Which crawlers does the AI preset block?',
      a: 'GPTBot, ChatGPT-User, CCBot, Google-Extended, anthropic-ai, ClaudeBot, PerplexityBot, Bytespider, Amazonbot and FacebookBot, each as its own User-agent block, followed by an Allow: / for everyone else.',
    },
    {
      q: 'Does Crawl-delay apply to every crawler?',
      a: 'No. It is a request and most major search engines ignore it; smaller and older crawlers tend to honour it. It is placed after the user-agent blocks so it applies to the file as a whole.',
    },
  ],
} as const;
