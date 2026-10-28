import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-log-analyzer',
  name: 'Access Log Analyzer',
  category: 'web',
  summary:
    'Analyze Apache and nginx access logs: traffic, top lists, status codes, errors and probes.',
  description:
    'Paste or drop a Common or Combined Log Format access log and get the numbers an operator actually looks for: request and byte totals, the time span covered, status class breakdown and error rate, top IPs, paths, user agents and referrers, the full status distribution, every 4xx and 5xx grouped by path, and findings that name the bots, the scanners, the sensitive paths being probed and the responses that are suspiciously empty.',
  keywords: [
    'access log analyzer',
    'apache log',
    'nginx log',
    'combined log format',
    'common log format',
    'http status codes',
    '404 report',
    'log parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.log,.txt,.out,text/plain,application/octet-stream',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'summary', label: 'Traffic summary' },
        { value: 'top', label: 'Top lists' },
        { value: 'status', label: 'Status distribution' },
        { value: 'errors', label: 'Errors by path' },
        { value: 'findings', label: 'Findings' },
      ],
      default: 'summary',
    },
    {
      key: 'top',
      label: 'Rows per top list',
      type: 'number',
      default: 10,
      min: 3,
      step: 1,
    },
    {
      key: 'security',
      label: 'Check for probes and scanners',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A few combined-log lines',
      input:
        '203.0.113.10 - - [10/Oct/2000:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 1043 "https://example.com/" "Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0"\n198.51.100.7 - - [10/Oct/2000:13:55:37 -0700] "GET /.env HTTP/1.0" 404 209 "-" "curl/8.0.1"\n203.0.113.10 - - [10/Oct/2000:13:55:38 -0700] "GET /assets/app.js HTTP/1.1" 200 51200 "https://example.com/" "Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0"\n66.249.66.1 - - [10/Oct/2000:13:56:02 -0700] "GET /robots.txt HTTP/1.1" 200 42 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"',
    },
    {
      title: 'Top lists from a combined log',
      options: { format: 'top', top: 10 },
    },
    {
      title: 'Probe and scanner findings',
      options: { format: 'findings', security: true },
    },
  ],
  related: ['http-header-analyzer', 'user-agent', 'url-parse', 'robots-txt'],
  status: 'stable',
};
