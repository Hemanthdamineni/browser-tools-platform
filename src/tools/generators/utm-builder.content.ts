/**
 * Editorial content for the utm-builder tool page.
 *
 * Kept out of ``utm-builder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Enter a full URL and fill any of the five UTM fields — source, medium, campaign, term, content — and the tool returns the tagged URL followed by a plain breakdown listing each parameter it set.',
    },
    {
      heading: 'A concrete use',
      body: 'Tagging a newsletter link with source=newsletter, medium=email and campaign=spring so analytics can tell that traffic apart from search.',
    },
    {
      heading: 'How the options behave',
      body: 'lowercase forces every value you supply to lower case, which matters because analytics treat Email and email as different mediums. stripExisting removes any utm_* parameters already on the URL before adding yours; turn it off and the tool appends your values alongside existing ones. If source, medium or campaign is empty, a warning names exactly which are missing.',
    },
    {
      heading: 'Limits to know',
      body: 'The input must parse as a URL with a scheme, so a bare example.com path is rejected with the hint to add https://. Empty input returns an empty result rather than an error. Stripping matches any parameter whose name starts with utm_ ignoring case, so utm_custom is removed too.',
    },
    {
      heading: 'Privacy',
      body: 'The URL and its parameters are assembled in your browser — no request is made to the destination or anywhere else.',
    },
  ],
  faq: [
    {
      q: 'Which parameters should I always set?',
      a: 'Google recommends utm_source, utm_medium and utm_campaign as a minimum — the tool warns if any of the three is missing.',
    },
    {
      q: 'Do UTM parameters affect SEO?',
      a: 'Tagged URLs are treated as separate addresses by analytics, but search engines canonicalise them away. Use them in campaigns, not in your internal links.',
    },
    {
      q: 'What happens if the URL already has UTM parameters?',
      a: 'With Replace existing utm_* parameters on (the default) every utm_ parameter already on the URL is deleted first, whatever its case, so no stale tags survive. Turn it off and your values are appended next to the existing ones instead of overwriting them.',
    },
  ],
} as const;
