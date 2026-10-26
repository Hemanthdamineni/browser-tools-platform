/**
 * Editorial content for the feed-inspector tool page.
 *
 * Kept out of ``feed-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What a feed actually contains',
      body: 'Paste or drop an RSS, Atom or RDF feed and the tool names its dialect and version, then reads the channel or feed-level details — title, link, language and generator — and lists every item with its date, identifier, author and, when present, its enclosure. The summary and items views are the read at a glance; the enclosures view is the check podcast directories care about.',
    },
    {
      heading: 'The problems it finds',
      body: 'With spec checking on, every item is held against its dialect’s requirements: RSS 2.0 needs a channel title, link and description and each item a title or a description; Atom needs id, title and updated on both feed and entry, and an author unless every entry carries one. Dates must carry a timezone, identifiers must not repeat, and an enclosure needs its url, type and length.',
    },
    {
      heading: 'The timezone trap',
      body: 'RSS dates are RFC 822 date-times, where a zone is mandatory. A bare "23 Sep 2024 09:00:00" is ambiguous — a reader in another timezone will shift it — so the tool warns and suggests adding +0000 or GMT. That warning catches more broken feeds than any other rule.',
    },
    {
      heading: 'Formats and limits',
      body: 'RSS 2.0 and the 0.9x shapes, RSS 1.0 / RDF, and Atom 1.0 are recognised; Atom 0.3 is parsed but flagged as legacy, and an unknown root element is reported rather than guessed at. The views — summary, items, enclosures and problems — let you jump to the table that matters. An unknown dialect still lets you read the items, just without a spec checklist.',
    },
    {
      heading: 'The feed is read, never fetched',
      body: 'Only the bytes you provide are parsed, in this tab. No URL is requested and no enclosure is downloaded, so enclosure sizes come from the length attribute rather than the network. That keeps the tool private and fully offline.',
    },
  ],
  faq: [
    {
      q: 'Which feed formats are supported?',
      a: 'RSS 2.0 (and the 0.9x versions that share its shape), RSS 1.0 / RDF, and Atom 1.0. Atom 0.3 is parsed but flagged as legacy, and an unknown root element is reported instead of guessed at.',
    },
    {
      q: 'What does it check?',
      a: 'For RSS 2.0 the channel needs title, link and description, and every item needs a title or a description. For Atom an entry needs id, title and updated, a feed needs id, title and updated plus an author unless every entry carries one, and link elements need an href. Date formats, duplicate identifiers and enclosure attributes are checked in both.',
    },
    {
      q: 'Why does my feed warn about a missing timezone?',
      a: 'RSS dates are RFC 822 date-times, where a zone is required; a bare "23 Sep 2024 09:00:00" is ambiguous and readers in other timezones will shift it. Adding +0000 or GMT removes the guesswork.',
    },
    {
      q: 'Does it fetch the feed or its enclosures?',
      a: 'No. The file is parsed exactly as given and nothing is requested, so enclosure URLs are reported as text and their file sizes come from the length attribute rather than from the network.',
    },
  ],
} as const;
