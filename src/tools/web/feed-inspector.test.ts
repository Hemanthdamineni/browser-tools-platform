import { describe, expect, it } from 'vitest';
import tool from './feed-inspector.tool';

type Result = {
  outputs: unknown[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [], text, options })) as Result;

const view = async (
  text: string,
  format: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Table> => {
  const result = await run(text, { ...options, format });
  return JSON.parse(result.report?.output ?? '{}') as Table;
};

const summary = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const table = await view(text, 'summary', options);
  const map: Record<string, string> = {};
  for (const row of table.rows) {
    const key = row[0];
    const value = row[1];
    if (key !== undefined && value !== undefined) map[key] = value;
  }
  return map;
};

const problems = (table: Table): string[] => table.rows.map((row) => row[2] ?? '');

const AAA =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const RSS = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
  '  <channel>',
  '    <title>The Example Show</title>',
  '    <link>https://example.com/</link>',
  '    <description>Weekly notes.</description>',
  '    <language>en-gb</language>',
  '    <lastBuildDate>Tue, 01 Oct 2024 09:00:00 +0000</lastBuildDate>',
  '    <generator>Example CMS 1.0</generator>',
  '    <item>',
  '      <title>Episode 2</title>',
  '      <link>https://example.com/2</link>',
  '      <guid isPermaLink="false">example-2</guid>',
  '      <pubDate>Mon, 30 Sep 2024 09:00:00 +0000</pubDate>',
  '      <description>The second.</description>',
  '      <enclosure url="https://example.com/2.mp3" type="audio/mpeg" length="10485760"/>',
  '    </item>',
  '    <item>',
  '      <title>Episode 1</title>',
  '      <link>https://example.com/1</link>',
  '      <guid isPermaLink="false">example-1</guid>',
  '      <pubDate>Mon, 23 Sep 2024 09:00:00 GMT</pubDate>',
  '      <description>The first.</description>',
  '    </item>',
  '  </channel>',
  '</rss>',
].join('\n');

const ATOM = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<feed xmlns="http://www.w3.org/2005/Atom">',
  '  <title>Example Atom</title>',
  '  <link href="https://example.com/atom" rel="alternate"/>',
  '  <id>urn:uuid:feed-1</id>',
  '  <updated>2024-10-01T09:00:00Z</updated>',
  '  <author><name>Alice</name></author>',
  '  <entry>',
  '    <title>First post</title>',
  '    <link href="https://example.com/post-1" rel="alternate"/>',
  '    <id>urn:uuid:post-1</id>',
  '    <updated>2024-09-30T09:00:00Z</updated>',
  '    <summary>Hello</summary>',
  '  </entry>',
  '</feed>',
].join('\n');

const RSS1 = [
  '<?xml version="1.0"?>',
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">',
  '  <channel rdf:about="https://example.com/feed">',
  '    <title>Example RSS 1</title>',
  '    <link>https://example.com/</link>',
  '    <description>Old school.</description>',
  '  </channel>',
  '  <item rdf:about="https://example.com/1">',
  '    <title>One</title>',
  '    <link>https://example.com/1</link>',
  '    <description>First.</description>',
  '  </item>',
  '</rdf:RDF>',
].join('\n');

const BROKEN_RSS = [
  '<rss version="2.0">',
  '  <channel>',
  '    <title></title>',
  '    <item>',
  '      <guid isPermaLink="maybe">dup</guid>',
  '      <pubDate>Mon, 23 Sep 2024 09:00:00</pubDate>',
  '      <enclosure url="2.mp3"/>',
  '    </item>',
  '    <item>',
  '      <title>Two</title>',
  '      <guid isPermaLink="false">dup</guid>',
  '      <link>https://example.com/2</link>',
  '      <pubDate>nonsense date</pubDate>',
  '      <enclosure url="https://example.com/2.mp3" type="audio/mpeg" length="12MB"/>',
  '    </item>',
  '  </channel>',
  '</rss>',
].join('\n');

const BROKEN_ATOM = [
  '<feed xmlns="http://www.w3.org/2005/Atom">',
  '  <entry><summary>only a summary</summary></entry>',
  '</feed>',
].join('\n');

describe('feed-inspector', () => {
  it('summarizes an RSS 2.0 channel', async () => {
    const map = await summary(RSS);
    expect(map.Dialect).toBe('RSS 2.0');
    expect(map.Title).toBe('The Example Show');
    expect(map.Link).toBe('https://example.com/');
    expect(map.Language).toBe('en-gb');
    expect(map['Last updated']).toBe('2024-10-01T09:00:00.000Z');
    expect(map.Generator).toBe('Example CMS 1.0');
    expect(map.Items).toBe('2');
    expect(map.Enclosures).toBe('1');
    expect(map['Podcast extensions']).toBe('yes');
  });

  it('reports the item date range', async () => {
    const map = await summary(RSS);
    expect(map['Item date range']).toBe('2024-09-23T09:00:00.000Z to 2024-09-30T09:00:00.000Z');
  });

  it('finds no problems in a well-formed RSS feed', async () => {
    const result = await run(RSS);
    expect(result.stats).toMatchObject({
      dialect: 'RSS 2.0',
      items: 2,
      enclosures: 1,
      errors: 0,
      warnings: 0,
    });
    expect(result.warnings ?? []).toEqual([]);
    const issues = await view(RSS, 'issues');
    expect(issues.rows[0]?.[1]).toBe('ok');
  });

  it('lists items with dates, identifiers and enclosures', async () => {
    const table = await view(RSS, 'items');
    expect(table.headers).toEqual([
      '#',
      'Title',
      'Link',
      'Date',
      'Identifier',
      'Author',
      'Enclosure',
    ]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toEqual([
      '1',
      'Episode 2',
      'https://example.com/2',
      '2024-09-30T09:00:00.000Z',
      'example-2',
      'n/a',
      '1 (audio/mpeg)',
    ]);
    expect(table.rows[1]?.[6]).toBe('-');
  });

  it('lists enclosures with a human readable size', async () => {
    const table = await view(RSS, 'enclosures');
    expect(table.headers).toEqual(['Item', 'URL', 'Type', 'Size']);
    expect(table.rows[0]).toEqual([
      '1. Episode 2',
      'https://example.com/2.mp3',
      'audio/mpeg',
      '10.0 MB',
    ]);
  });

  it('says so when a feed has no enclosures', async () => {
    const table = await view(ATOM, 'enclosures');
    expect(table.rows[0]?.[3]).toBe('This feed has no media enclosures.');
  });

  it('summarizes an Atom feed and recognises its namespace', async () => {
    const map = await summary(ATOM);
    expect(map.Dialect).toBe('Atom 1.0');
    expect(map.Link).toBe('https://example.com/atom');
    expect(map['Last updated']).toBe('2024-10-01T09:00:00.000Z');
    expect(map.Namespaces).toBe('Atom');
    expect(map.Items).toBe('1');
    const result = await run(ATOM);
    expect(result.stats?.errors).toBe(0);
  });

  it('summarizes an RSS 1.0 RDF feed', async () => {
    const map = await summary(RSS1);
    expect(map.Dialect).toBe('RSS 1.0 (RDF)');
    expect(map.Namespaces).toBe('RDF, RSS 1.0');
    expect(map.Items).toBe('1');
    const result = await run(RSS1);
    expect(result.stats?.errors).toBe(0);
    expect(result.stats?.warnings).toBe(0);
  });

  it('reports the missing requirements of a broken RSS feed', async () => {
    const result = await run(BROKEN_RSS);
    const found = problems(await view(BROKEN_RSS, 'issues'));
    expect(found).toContain('Missing channel title');
    expect(found).toContain('Missing channel link');
    expect(found).toContain('Missing channel description');
    expect(found).toContain('No title and no description');
    expect(found).toContain('Unparsable date');
    expect(found).toContain('Date has no timezone');
    expect(found).toContain('Unexpected isPermaLink value');
    expect(found).toContain('Duplicate identifier');
    expect(found).toContain('Relative enclosure url');
    expect(found).toContain('Enclosure without a type');
    expect(found).toContain('Enclosure without a length');
    expect(found).toContain('Enclosure length is not a byte count');
    expect(result.stats?.errors).toBe(5);
    expect(result.warnings?.join(' ')).toMatch(/5 specification error/i);
  });

  it('reports the missing requirements of a broken Atom feed', async () => {
    const found = problems(await view(BROKEN_ATOM, 'issues'));
    expect(found).toContain('Missing feed id');
    expect(found).toContain('Missing feed title');
    expect(found).toContain('Missing feed updated');
    expect(found).toContain('Missing author');
    expect(found).toContain('Missing entry title');
    expect(found).toContain('Missing entry id');
    expect(found).toContain('Missing updated date');
    const result = await run(BROKEN_ATOM);
    expect(result.stats?.errors).toBe(7);
  });

  it('flags a date that is not RFC 3339 in an Atom entry', async () => {
    const atom = [
      '<feed xmlns="http://www.w3.org/2005/Atom">',
      '  <title>t</title><id>urn:1</id><updated>2024-10-01T09:00:00Z</updated><author><name>a</name></author>',
      '  <entry><title>e</title><id>urn:2</id><updated>2024-09-30 09:00:00</updated></entry>',
      '</feed>',
    ].join('\n');
    const found = problems(await view(atom, 'issues'));
    expect(found).toContain('Date is not RFC 3339');
  });

  it('flags dates in the future', async () => {
    const rss = RSS.replace('Mon, 30 Sep 2024 09:00:00 +0000', 'Fri, 01 Oct 2999 09:00:00 +0000');
    const found = problems(await view(rss, 'issues'));
    expect(found).toContain('Date is in the future');
  });

  it('flags duplicate links', async () => {
    const rss = RSS.replace('https://example.com/1', 'https://example.com/2');
    const found = problems(await view(rss, 'issues'));
    expect(found).toContain('Duplicate link');
  });

  it('flags a relative feed link and a missing version', async () => {
    const rss =
      '<rss><channel><title>t</title><link>/feed</link><description>d</description></channel></rss>';
    const found = problems(await view(rss, 'issues'));
    expect(found).toContain('Missing version attribute');
    expect(found).toContain('Relative feed link');
  });

  it('warns about the deprecated Atom 0.3 namespace', async () => {
    const old = '<feed xmlns="http://purl.org/atom/ns#"><title>t</title></feed>';
    const result = await run(old);
    expect(result.stats?.dialect).toBe('Atom 0.3 (legacy)');
    const found = problems(await view(old, 'issues'));
    expect(found).toContain('Atom 0.3 is deprecated');
  });

  it('warns when a feed has no items', async () => {
    const empty = [
      '<rss version="2.0"><channel><title>t</title><link>https://e.com/</link><description>d</description></channel></rss>',
    ].join('');
    const found = problems(await view(empty, 'issues'));
    expect(found).toContain('The feed has no items');
  });

  it('can skip the specification checks', async () => {
    const result = await run(BROKEN_RSS, { checkSpec: false });
    expect(result.stats?.errors).toBe(0);
    expect(result.stats?.warnings).toBe(0);
    expect(result.notes?.join(' ')).toMatch(/checks were disabled/i);
    const issues = await view(BROKEN_RSS, 'issues', { checkSpec: false });
    expect(issues.rows[0]?.[2]).toBe('No problems found');
  });

  it('reads a feed from a File', async () => {
    const file = new File([ATOM], 'feed.xml', { type: 'application/atom+xml' });
    const result = (await tool.run({ files: [file], options: {} })) as Result;
    expect(result.stats?.items).toBe(1);
    expect(result.stats?.dialect).toBe('Atom 1.0');
  });

  it('caps how many items it lists', async () => {
    const items = Array.from(
      { length: 210 },
      (_, index) => '<item><title>i' + index + '</title></item>',
    ).join('');
    const rss =
      '<rss version="2.0"><channel><title>t</title><link>https://e.com/</link><description>d</description>' +
      items +
      '</channel></rss>';
    const result = await run(rss, { format: 'items' });
    const table = JSON.parse(result.report?.output ?? '{}') as Table;
    expect(table.rows).toHaveLength(200);
    expect(result.stats?.items).toBe(210);
    expect(result.notes?.join(' ')).toMatch(/first 200 of 210 items/i);
  });

  it('clips long text instead of dumping it', async () => {
    const rss = RSS.replace('Weekly notes.', AAA + AAA);
    const map = await summary(rss);
    expect((map.Description ?? '').length).toBeLessThanOrEqual(120);
    expect(map.Description?.endsWith('…')).toBe(true);
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/no feed was provided/i);
  });

  it('rejects markup that is not well-formed XML', async () => {
    await expect(run('<rss><channel>')).rejects.toThrow(/not well-formed feed xml/i);
  });

  it('rejects a document that is not a feed', async () => {
    await expect(run('<html><body>hi</body></html>')).rejects.toThrow(
      /unrecognised feed root element <html>/i,
    );
  });
});
