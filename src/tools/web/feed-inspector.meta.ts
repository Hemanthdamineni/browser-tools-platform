import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'feed-inspector',
  name: 'Feed Inspector',
  category: 'web',
  summary: 'Inspect an RSS, Atom or RDF feed: channel details, items, enclosures and spec problems.',
  description:
    'Paste or drop a feed and see what it actually contains: the dialect and version, channel title, link, language and generator, every item with its date, identifier, author and enclosure, and a list of problems — missing required elements, malformed or zone-less dates, duplicate identifiers, broken links and enclosure details that podcast directories reject.',
  keywords: [
    'rss validator',
    'atom feed inspector',
    'feed reader debug',
    'podcast feed check',
    'rss channel',
    'atom entry',
    'rss pubdate',
    'xml feed parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.xml,.rss,.atom,.txt,application/rss+xml,application/atom+xml,text/xml,application/xml',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'summary', label: 'Feed summary' },
        { value: 'items', label: 'Items' },
        { value: 'enclosures', label: 'Enclosures' },
        { value: 'issues', label: 'Problems' },
      ],
      default: 'summary',
    },
    {
      key: 'checkSpec',
      label: 'Check against the feed specification',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A two item RSS 2.0 feed with an enclosure',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n  <channel>\n    <title>The Example Show</title>\n    <link>https://example.com/</link>\n    <description>Weekly notes about examples.</description>\n    <language>en-gb</language>\n    <lastBuildDate>Tue, 01 Oct 2024 09:00:00 +0000</lastBuildDate>\n    <item>\n      <title>Episode 2</title>\n      <link>https://example.com/2</link>\n      <guid isPermaLink="false">example-2</guid>\n      <pubDate>Mon, 30 Sep 2024 09:00:00 +0000</pubDate>\n      <description>The second episode.</description>\n      <enclosure url="https://example.com/2.mp3" type="audio/mpeg" length="10485760"/>\n    </item>\n    <item>\n      <title>Episode 1</title>\n      <link>https://example.com/1</link>\n      <guid isPermaLink="false">example-1</guid>\n      <pubDate>23 Sep 2024 09:00:00 GMT</pubDate>\n      <description>The first episode.</description>\n    </item>\n  </channel>\n</rss>',
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
  related: ['xml-format', 'html-validator', 'url-parse', 'json-format'],
  status: 'stable',
};
