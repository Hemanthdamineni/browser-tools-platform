import { describe, expect, it } from 'vitest';
import tool from './access-log-analyzer.tool';

type Result = {
  outputs: unknown[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

// The log and every expectation below are produced by a Python oracle that parses the
// same fixture with its own regex and Counter, so the numbers are not this tool's output.
const LOG = "203.0.113.10 - - [10/Oct/2000:13:35:36 -0700] \"GET / HTTP/1.1\" 200 1043 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:37 -0700] \"GET /index.html HTTP/1.1\" 200 1043 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:38 -0700] \"GET /assets/app.js HTTP/1.1\" 200 51200 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:39 -0700] \"GET /assets/app.css HTTP/1.1\" 200 12800 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:40 -0700] \"GET /api/items?page=2 HTTP/1.1\" 200 4021 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:41 -0700] \"GET /favicon.ico HTTP/1.1\" 200 0 \"-\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:42 -0700] \"GET /downloads/report.pdf HTTP/1.1\" 200 2000000 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:43 -0700] \"GET /missing-page HTTP/1.1\" 404 209 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:44 -0700] \"GET /api/items?page=3 HTTP/1.1\" 304 0 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:45 -0700] \"GET /healthz HTTP/1.1\" 200 - \"-\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:46 -0700] \"POST /api/items HTTP/1.1\" 201 512 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n203.0.113.10 - - [10/Oct/2000:13:35:47 -0700] \"GET /old-section HTTP/1.1\" 301 0 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n198.51.100.7 - - [10/Oct/2000:13:35:50 -0700] \"GET /.env HTTP/1.1\" 404 209 \"-\" \"curl/8.0.1\"\n198.51.100.7 - - [10/Oct/2000:13:35:51 -0700] \"GET /.git/config HTTP/1.1\" 404 209 \"-\" \"curl/8.0.1\"\n198.51.100.7 - - [10/Oct/2000:13:35:52 -0700] \"GET /wp-login.php HTTP/1.1\" 404 209 \"-\" \"curl/8.0.1\"\n198.51.100.7 - - [10/Oct/2000:13:35:53 -0700] \"GET /admin HTTP/1.1\" 404 209 \"-\" \"python-requests/2.31.0\"\n198.51.100.7 - - [10/Oct/2000:13:35:54 -0700] \"GET /phpmyadmin/ HTTP/1.1\" 404 209 \"-\" \"python-requests/2.31.0\"\n198.51.100.7 - - [10/Oct/2000:13:35:55 -0700] \"GET /a1b2c3 HTTP/1.1\" 404 209 \"-\" \"curl/8.0.1\"\n198.51.100.7 - - [10/Oct/2000:13:35:56 -0700] \"GET /z9y8x7 HTTP/1.1\" 404 209 \"-\" \"python-requests/2.31.0\"\n198.51.100.7 - - [10/Oct/2000:13:35:57 -0700] \"GET /qwerty HTTP/1.1\" 404 209 \"-\" \"python-requests/2.31.0\"\n66.249.66.1 - - [10/Oct/2000:13:36:00 -0700] \"GET /robots.txt HTTP/1.1\" 200 42 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:01 -0700] \"GET /sitemap.xml HTTP/1.1\" 200 900 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:02 -0700] \"GET /page-1 HTTP/1.1\" 200 5000 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:03 -0700] \"GET /page-2 HTTP/1.1\" 200 5000 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:04 -0700] \"GET /page-3 HTTP/1.1\" 200 5000 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:05 -0700] \"GET /page-4 HTTP/1.1\" 200 5000 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:06 -0700] \"GET /page-5 HTTP/1.1\" 200 5000 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:07 -0700] \"GET /page-6 HTTP/1.1\" 200 5000 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:08 -0700] \"GET /assets/app.js HTTP/1.1\" 200 5000 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n66.249.66.1 - - [10/Oct/2000:13:36:09 -0700] \"GET /index.html HTTP/1.1\" 200 5000 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\"\n2001:db8::1 - - [10/Oct/2000:13:36:20 -0700] \"GET / HTTP/1.0\" 200 1043 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n2001:db8::1 - - [10/Oct/2000:13:36:21 -0700] \"GET /pricing HTTP/1.0\" 200 2048 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n2001:db8::1 - - [10/Oct/2000:13:36:22 -0700] \"GET /old HTTP/1.0\" 301 0 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n2001:db8::1 - - [10/Oct/2000:13:36:23 -0700] \"GET /gone HTTP/1.0\" 410 128 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n2001:db8::1 - - [10/Oct/2000:13:36:24 -0700] \"GET / HTTP/1.0\" 200 1043 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\n192.0.2.50 - - [10/Oct/2000:13:36:30 -0700] \"GET /api/checkout HTTP/1.0\" 500 320 \"-\" \"python-requests/2.31.0\"\n192.0.2.50 - - [10/Oct/2000:13:36:31 -0700] \"GET /api/checkout HTTP/1.0\" 500 320 \"-\" \"python-requests/2.31.0\"\n192.0.2.50 - - [10/Oct/2000:13:36:32 -0700] \"POST /api/checkout HTTP/1.0\" 500 410 \"-\" \"python-requests/2.31.0\"\n192.0.2.50 - - [10/Oct/2000:13:36:33 -0700] \"GET /api/health HTTP/1.0\" 503 210 \"-\" \"python-requests/2.31.0\"\n192.0.2.50 - - [10/Oct/2000:13:36:34 -0700] \"GET /api/checkout HTTP/1.0\" 500 320 \"-\" \"python-requests/2.31.0\"\n192.0.2.60 - - [10/Oct/2000:13:36:40 -0700] \"GET /rate-limited HTTP/1.0\" 429 180 \"-\" \"-\"\n192.0.2.60 - - [10/Oct/2000:13:36:41 -0700] \"GET /private HTTP/1.0\" 403 150 \"-\" \"-\"\n192.0.2.70 - - [10/Oct/2000:13:36:50 -0700] \"GET /healthz HTTP/1.1\" 200 0 \"-\" \"-\"\n192.0.2.70 - - [10/Oct/2000:13:36:51 -0700] \"GET /healthz HTTP/1.1\" 200 0 \"-\" \"-\"\n203.0.113.99 - - [10/Oct/2000:13:37:00 -0700] \"GET /blog/post HTTP/1.1\" 200 8000 \"https://search.example/\" \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36\"\n203.0.113.99 - - [10/Oct/2000:13:37:01 -0700] \"GET /blog/post?utm=1 HTTP/1.1\" 200 8000 \"https://search.example/\" \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36\"";
const MALFORMED = "203.0.113.10 - - [10/Oct/2000:13:35:36 -0700] \"GET / HTTP/1.1\" 200 1043 \"https://example.com/\" \"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\"\nthis line is not a log entry at all\n198.51.100.7 - - [10/Oct/2000:13:35:50 -0700] \"GET /.env HTTP/1.1\" 404 209 \"-\" \"curl/8.0.1\"\n\n[10/Oct/2000:13:55:38 -0700] GET /broken";
const EXPECTED = {"lines": 46, "parsed": 46, "skipped": 0, "blank": 0, "requests": 46, "requestsText": "46", "linesText": "46", "totalBytes": 2135614, "totalBytesText": "2,135,614", "uniqueIps": 8, "uniquePaths": 34, "uniqueAgents": 6, "statuses": {"200": 25, "201": 1, "301": 2, "304": 1, "403": 1, "404": 9, "410": 1, "429": 1, "500": 4, "503": 1}, "classes": {"success": 26, "redirect": 3, "client": 12, "server": 5, "successText": "26 (56.5%)", "redirectText": "3 (6.5%)", "clientText": "12 (26.1%)", "serverText": "5 (10.9%)"}, "errorCount": 17, "errorRate": "37.0%", "bots": 10, "clients": 13, "noAgent": 4, "unknownSize": 1, "emptyOk": 3, "http10": 12, "first": "2000-10-10T20:35:36.000Z", "last": "2000-10-10T20:37:01.000Z", "methods": "GET × 44, POST × 2", "protocols": "HTTP/1.1 × 34, HTTP/1.0 × 12", "topIps": [{"value": "203.0.113.10", "hits": 12, "hitsText": "12", "share": "26.1%"}, {"value": "66.249.66.1", "hits": 10, "hitsText": "10", "share": "21.7%"}, {"value": "198.51.100.7", "hits": 8, "hitsText": "8", "share": "17.4%"}, {"value": "2001:db8::1", "hits": 5, "hitsText": "5", "share": "10.9%"}, {"value": "192.0.2.50", "hits": 5, "hitsText": "5", "share": "10.9%"}, {"value": "203.0.113.99", "hits": 2, "hitsText": "2", "share": "4.3%"}, {"value": "192.0.2.60", "hits": 2, "hitsText": "2", "share": "4.3%"}, {"value": "192.0.2.70", "hits": 2, "hitsText": "2", "share": "4.3%"}], "topPaths": [{"value": "/api/checkout", "hits": 4}, {"value": "/api/items", "hits": 3}, {"value": "/", "hits": 3}, {"value": "/healthz", "hits": 3}, {"value": "/assets/app.js", "hits": 2}, {"value": "/blog/post", "hits": 2}, {"value": "/index.html", "hits": 2}, {"value": "/downloads/report.pdf", "hits": 1}, {"value": "/assets/app.css", "hits": 1}, {"value": "/page-1", "hits": 1}], "topAgents": [{"value": "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0", "hits": 17}, {"value": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "hits": 10}, {"value": "python-requests/2.31.0", "hits": 9}, {"value": "-", "hits": 4}, {"value": "curl/8.0.1", "hits": 4}, {"value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", "hits": 2}], "errors": [{"status": 500, "method": "GET", "path": "/api/checkout", "hits": 3}, {"status": 403, "method": "GET", "path": "/private", "hits": 1}, {"status": 404, "method": "GET", "path": "/.env", "hits": 1}, {"status": 404, "method": "GET", "path": "/.git/config", "hits": 1}, {"status": 404, "method": "GET", "path": "/a1b2c3", "hits": 1}, {"status": 404, "method": "GET", "path": "/admin", "hits": 1}, {"status": 404, "method": "GET", "path": "/missing-page", "hits": 1}, {"status": 404, "method": "GET", "path": "/phpmyadmin/", "hits": 1}, {"status": 404, "method": "GET", "path": "/qwerty", "hits": 1}, {"status": 404, "method": "GET", "path": "/wp-login.php", "hits": 1}, {"status": 404, "method": "GET", "path": "/z9y8x7", "hits": 1}, {"status": 410, "method": "GET", "path": "/gone", "hits": 1}, {"status": 429, "method": "GET", "path": "/rate-limited", "hits": 1}, {"status": 500, "method": "POST", "path": "/api/checkout", "hits": 1}, {"status": 503, "method": "GET", "path": "/api/health", "hits": 1}], "probes": [{"path": "/.env", "hits": 1}, {"path": "/.git", "hits": 1}, {"path": "/admin", "hits": 1}, {"path": "/phpmyadmin", "hits": 1}, {"path": "/wp-login", "hits": 1}], "scanner": {"ip": "198.51.100.7", "notFound": 8, "total": 8}, "largest": {"path": "/downloads/report.pdf", "bytes": 2000000}, "malformedSkipped": 2, "malformedBlank": 1} as {
  lines: number;
  parsed: number;
  skipped: number;
  blank: number;
  requests: number;
  requestsText: string;
  linesText: string;
  totalBytes: number;
  totalBytesText: string;
  uniqueIps: number;
  uniquePaths: number;
  uniqueAgents: number;
  statuses: Record<string, number>;
  classes: {
    success: number;
    redirect: number;
    client: number;
    server: number;
    successText: string;
    redirectText: string;
    clientText: string;
    serverText: string;
  };
  errorRate: string;
  errorCount: number;
  bots: number;
  clients: number;
  noAgent: number;
  unknownSize: number;
  emptyOk: number;
  http10: number;
  first: string;
  last: string;
  methods: string;
  protocols: string;
  topIps: { value: string; hits: number; hitsText: string; share: string }[];
  topPaths: { value: string; hits: number }[];
  topAgents: { value: string; hits: number }[];
  errors: { status: number; method: string; path: string; hits: number }[];
  probes: { path: string; hits: number }[];
  scanner: { ip: string; notFound: number; total: number };
  largest: { path: string; bytes: number };
  malformedSkipped: number;
  malformedBlank: number;
};

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [], text, options })) as Result;

const runFile = async (text: string, name: string) =>
  (await tool.run({ files: [new File([text], name, { type: 'text/plain' })], options: {} })) as Result;

const table = (result: Result): Table => JSON.parse(result.report?.output ?? '{}') as Table;
const view = async (format: string, options: Record<string, string | number | boolean> = {}) =>
  table(await run(LOG, { format, ...options }));
const rowsFor = (rows: string[][], group: string): string[][] => rows.filter((row) => row[0] === group);
const byFirstColumn = (rows: string[][]): Map<string, string[]> =>
  new Map(rows.map((row) => [row[0] ?? '', row]));
const problems = (rows: string[][]): string[] => rows.map((row) => row[1] ?? '');

describe('access-log-analyzer', () => {
  it('reports the request totals the oracle counted', async () => {
    const summary = byFirstColumn((await view('summary')).rows);
    expect(summary.get('Lines read')?.[1]).toBe(EXPECTED.linesText);
    expect(summary.get('Lines parsed')?.[1]).toBe(EXPECTED.requestsText);
    expect(summary.get('Requests')?.[1]).toBe(EXPECTED.requestsText);
    expect(summary.get('Distinct addresses')?.[1]).toBe(String(EXPECTED.uniqueIps));
    expect(summary.get('Distinct paths')?.[1]).toBe(String(EXPECTED.uniquePaths));
    expect(summary.get('Distinct user agents')?.[1]).toBe(String(EXPECTED.uniqueAgents));
    expect(summary.get('Total bytes sent')?.[1]).toContain(EXPECTED.totalBytesText);
  });

  it('reports the time span from the log timestamps', async () => {
    const summary = byFirstColumn((await view('summary')).rows);
    expect(summary.get('First request')?.[1]).toBe(EXPECTED.first);
    expect(summary.get('Last request')?.[1]).toBe(EXPECTED.last);
  });

  it('breaks requests down by status class and error rate', async () => {
    const summary = byFirstColumn((await view('summary')).rows);
    expect(summary.get('2xx success')?.[1]).toBe(EXPECTED.classes.successText);
    expect(summary.get('3xx redirect')?.[1]).toBe(EXPECTED.classes.redirectText);
    expect(summary.get('4xx client error')?.[1]).toBe(EXPECTED.classes.clientText);
    expect(summary.get('5xx server error')?.[1]).toBe(EXPECTED.classes.serverText);
    expect(summary.get('Error rate')?.[1]).toBe(EXPECTED.errorRate);
    const classified =
      EXPECTED.classes.success + EXPECTED.classes.redirect + EXPECTED.classes.client + EXPECTED.classes.server;
    expect(classified).toBe(EXPECTED.requests);
  });

  it('separates crawlers, clients and browsers', async () => {
    const summary = byFirstColumn((await view('summary')).rows);
    expect(summary.get('Crawler requests')?.[1]).toContain(String(EXPECTED.bots));
    expect(summary.get('Command-line / library clients')?.[1]).toContain(String(EXPECTED.clients));
    expect(summary.get('Missing user agent')?.[1]).toBe(String(EXPECTED.noAgent));
  });

  it('lists the methods and protocols it saw', async () => {
    const summary = byFirstColumn((await view('summary')).rows);
    expect(summary.get('Methods')?.[1]).toBe(EXPECTED.methods);
    expect(summary.get('Protocols')?.[1]).toBe(EXPECTED.protocols);
  });

  it('agrees with the oracle on every numeric statistic', async () => {
    const result = await run(LOG);
    expect(result.stats?.lines).toBe(EXPECTED.lines);
    expect(result.stats?.parsed).toBe(EXPECTED.parsed);
    expect(result.stats?.skipped).toBe(EXPECTED.skipped);
    expect(result.stats?.requests).toBe(EXPECTED.requests);
    expect(result.stats?.totalBytes).toBe(EXPECTED.totalBytes);
    expect(result.stats?.uniqueIps).toBe(EXPECTED.uniqueIps);
    expect(result.stats?.uniquePaths).toBe(EXPECTED.uniquePaths);
    expect(result.stats?.errorCount).toBe(EXPECTED.errorCount);
    expect(result.stats?.bots).toBe(EXPECTED.bots);
    expect(result.stats?.clients).toBe(EXPECTED.clients);
    expect(result.stats?.probes).toBe(EXPECTED.probes.length);
  });

  it('ranks the top addresses, paths and user agents by hits', async () => {
    const rows = (await view('top')).rows;
    expect(rows[0]?.slice(0, 6)).toEqual(['Address', '1', EXPECTED.topIps[0]?.value, EXPECTED.topIps[0]?.hits.toLocaleString('en-US'), expect.any(String), EXPECTED.topIps[0]?.share]);
    expect(rowsFor(rows, 'Path')[0]?.[2]).toBe(EXPECTED.topPaths[0]?.value);
    expect(rowsFor(rows, 'User agent')[0]?.[2]).toContain(EXPECTED.topAgents[0]?.value.slice(0, 20));
    for (const group of ['Address', 'Path', 'User agent', 'Referrer']) {
      const hits = rowsFor(rows, group).map((row) => Number(row[3]?.replace(/,/gu, '')));
      expect(hits.length).toBeGreaterThan(0);
      expect(hits).toEqual([...hits].sort((a, b) => b - a));
      expect(hits[0]).toBeGreaterThanOrEqual(hits[hits.length - 1] ?? 0);
    }
  });

  it('honours the rows-per-list option', async () => {
    const rows = (await view('top', { top: 3 })).rows;
    for (const group of ['Address', 'Path', 'User agent', 'Referrer']) {
      expect(rowsFor(rows, group).length).toBeLessThanOrEqual(3);
    }
    expect(rowsFor(rows, 'Address').map((row) => row[1])).toEqual(['1', '2', '3']);
  });

  it('lists the full status distribution with reason phrases', async () => {
    const rows = (await view('status')).rows;
    const seen = new Map(rows.map((row) => [row[0] ?? '', Number(row[2]?.replace(/,/gu, ''))]));
    for (const [status, count] of Object.entries(EXPECTED.statuses)) {
      expect([status, seen.get(status)]).toEqual([status, count]);
    }
    const reason = new Map(rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(reason.get('200')).toBe('OK');
    expect(reason.get('404')).toBe('Not Found');
    expect(reason.get('500')).toBe('Internal Server Error');
    expect(rows.length).toBe(Object.keys(EXPECTED.statuses).length);
  });

  it('groups every failing request by path', async () => {
    const rows = (await view('errors')).rows;
    const seen = new Map(rows.map((row) => [row[0] + ' ' + row[2] + ' ' + row[3], Number(row[4]?.replace(/,/gu, ''))]));
    for (const error of EXPECTED.errors) {
      expect([error.status + ' ' + error.method + ' ' + error.path, seen.get(error.status + ' ' + error.method + ' ' + error.path)])
        .toEqual([error.status + ' ' + error.method + ' ' + error.path, error.hits]);
    }
    expect(rows.every((row) => Number(row[0]) >= 400)).toBe(true);
    expect(rows.length).toBe(EXPECTED.errors.length);
  });

  it('names the sensitive paths that were probed', async () => {
    const found = problems((await view('findings')).rows);
    for (const probe of EXPECTED.probes) {
      const match = found.find((problem) => problem === 'Sensitive path requested: ' + probe.path);
      expect([probe.path, match === undefined]).toEqual([probe.path, false]);
      const detail = (await view('findings')).rows.find((row) => row[1] === 'Sensitive path requested: ' + probe.path)?.[2] ?? '';
      expect(detail).toContain(probe.hits + ' request(s)');
    }
  });

  it('names the address that is collecting 404s', async () => {
    const found = problems((await view('findings')).rows);
    expect(found).toContain('An address is collecting 404s: ' + EXPECTED.scanner.ip);
    const detail = (await view('findings')).rows.find((row) => (row[1] ?? '').includes(EXPECTED.scanner.ip))?.[2] ?? '';
    expect(detail).toContain(String(EXPECTED.scanner.notFound));
  });

  it('warns about the error rate and the other traffic patterns', async () => {
    const found = problems((await view('findings')).rows);
    expect((await view('findings')).rows.some((row) => /responses were 4xx or 5xx/u.test(row.join(' ')))).toBe(true);
    expect(found.some((problem) => /Bots make up/u.test(problem))).toBe(true);
    expect(found.some((problem) => /command-line or library clients/u.test(problem))).toBe(true);
    expect(found.some((problem) => /had no user agent/u.test(problem))).toBe(true);
    expect(found.some((problem) => /no size recorded/u.test(problem))).toBe(true);
    expect(found.some((problem) => /zero bytes/u.test(problem))).toBe(true);
    expect(found.some((problem) => /HTTP\/1\.0 is still in use/u.test(problem))).toBe(true);
    expect(found.some((problem) => /over 1 MB/u.test(problem))).toBe(true);
    const rows = (await view('findings')).rows;
    expect(rows.every((row) => ['error', 'warning', 'note'].includes(row[0] ?? ''))).toBe(true);
  });

  it('can leave the probe and scanner checks out', async () => {
    const rows = (await view('findings', { security: false })).rows;
    const found = problems(rows);
    expect(found.some((problem) => problem.startsWith('Sensitive path requested'))).toBe(false);
    expect(found.some((problem) => problem.startsWith('An address is collecting 404s'))).toBe(false);
    expect(found.some((problem) => /Bots make up/u.test(problem))).toBe(true);
    expect((await run(LOG, { security: false })).stats?.requests).toBe(EXPECTED.requests);
  });

  it('survives lines that are not access log entries', async () => {
    const result = await run(MALFORMED);
    expect(result.stats?.parsed).toBe(2);
    expect(result.stats?.skipped).toBe(EXPECTED.malformedSkipped);
    expect(problems(table(await run(MALFORMED, { format: 'findings' })).rows)).toContain(
      EXPECTED.malformedSkipped + ' line(s) could not be parsed',
    );
    expect(problems(table(await run(MALFORMED, { format: 'findings' })).rows).some((row) => /blank line/u.test(row))).toBe(true);
    expect(result.warnings?.some((warning) => /could not be parsed/u.test(warning))).toBe(true);
  });

  it('understands the Common Log Format without a referrer or user agent', async () => {
    const common = [
      '127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326',
      '127.0.0.1 - - [10/Oct/2000:13:55:37 -0700] "POST /submit HTTP/1.1" 201 128',
    ].join('\n');
    const result = await run(common, { format: 'summary' });
    const summary = byFirstColumn(table(result).rows);
    expect(summary.get('Requests')?.[1]).toBe('2');
    expect(summary.get('Missing user agent')?.[1]).toBe('2');
    expect(table(await run(common, { format: 'top' })).rows.find((row) => row[0] === 'Referrer')?.[2]).toBe('(direct)');
  });

  it('reads a dropped file the same way as pasted text', async () => {
    const fromFile = await runFile(LOG, 'access.log');
    const fromText = await run(LOG);
    expect(fromFile.stats).toEqual(fromText.stats);
    expect(byFirstColumn(table(await runFile(LOG, 'access.log')).rows).get('Source')?.[1]).toBe('access.log');
  });

  it('explains an empty log instead of guessing', async () => {
    await expect(run('')).rejects.toThrow(/no log lines were provided/iu);
    await expect(run('   \n  \n')).rejects.toThrow(/no log lines were provided/iu);
  });

  it('refuses input that is not an access log at all', async () => {
    let error: { message: string; hint?: string } | null = null;
    try {
      await run('this is not a log line\nnor is this one\n');
    } catch (caught) {
      error = caught as { message: string; hint?: string };
    }
    expect(error?.message).toMatch(/no access log lines could be read/iu);
    expect(error?.hint).toContain('this is not a log line');
  });

  it('counts a redirect separately from a success', async () => {
    const log = '10.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET /old HTTP/1.1" 301 0\n10.0.0.1 - - [10/Oct/2000:13:55:37 -0700] "GET /new HTTP/1.1" 200 512';
    const summary = byFirstColumn(table(await run(log, { format: 'summary' })).rows);
    expect(summary.get('3xx redirect')?.[1]).toBe('1 (50.0%)');
    expect(summary.get('2xx success')?.[1]).toBe('1 (50.0%)');
    expect(summary.get('Total bytes sent')?.[1]).toContain('512');
  });

  it('says so when there were no errors at all', async () => {
    const log = '10.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET / HTTP/1.1" 200 10';
    const rows = table(await run(log, { format: 'errors' })).rows;
    expect(rows).toEqual([['-', 'No errors', '-', 'Every parsed request returned a status below 400.', '-', '-']]);
  });

  it('labels an unknown status code without inventing a reason phrase', async () => {
    const log = '10.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET / HTTP/1.1" 599 10';
    const rows = table(await run(log, { format: 'status' })).rows;
    expect(rows).toEqual([['599', 'Error', '1', '100.0%', '10 B']]);
  });

  it('ignores extra fields a custom log format might add', async () => {
    const log = '10.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET / HTTP/1.1" 200 10 "-" "Mozilla/5.0" extra-field 1.234';
    const result = await run(log, { format: 'summary' });
    expect(result.stats?.parsed).toBe(1);
    expect(result.stats?.skipped).toBe(0);
  });
});
