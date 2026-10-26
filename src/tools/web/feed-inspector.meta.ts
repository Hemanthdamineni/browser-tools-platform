import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'feed-inspector',
  name: 'Feed Inspector',
  category: 'web',
  summary:
    'Inspect an RSS, Atom or RDF feed: channel details, items, enclosures and spec problems.',
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
    {
      title: 'An Atom entry missing an author',
      input:
        '<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <title>Notes</title>\n  <id>urn:uuid:1</id>\n  <updated>2024-10-01T09:00:00Z</updated>\n  <entry>\n    <title>First post</title>\n    <id>urn:uuid:2</id>\n    <updated>2024-10-01T09:00:00Z</updated>\n  </entry>\n</feed>',
      options: { format: 'issues' },
    },
    {
      title: 'A feed with a zone-less pubDate',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Example</title>\n    <link>https://example.com/</link>\n    <description>Notes.</description>\n    <item>\n      <title>Post</title>\n      <pubDate>23 Sep 2024 09:00:00</pubDate>\n    </item>\n  </channel>\n</rss>',
      options: { format: 'issues' },
    },
  ],
  related: ['xml-format', 'html-validator', 'url-parse', 'json-format'],
  status: 'stable',
};
