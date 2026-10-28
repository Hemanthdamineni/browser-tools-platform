import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'curl-to-fetch',
  name: 'curl to fetch',
  category: 'developer',
  summary: 'Turn a curl command into ready-to-run JavaScript fetch, axios or Python requests code.',
  description:
    'Paste a curl command (including line continuations, single and double quotes) and get equivalent client code: browser/Node fetch with an options object, axios, or Python requests. Methods, headers, JSON or form bodies, Basic auth, cookies, user-agent and referer are all carried across, and the body is pretty-printed as a JavaScript object when it is JSON. Anything the converter cannot represent (output files, proxies, certificates) is listed as a note instead of being silently dropped, and everything runs on your device.',
  keywords: [
    'curl to fetch',
    'curl to javascript',
    'convert curl',
    'curl to axios',
    'curl to python requests',
    'curl command converter',
    'curl to code',
    'http request generator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'target',
      label: 'Generate',
      type: 'select',
      choices: [
        { value: 'fetch', label: 'JavaScript fetch' },
        { value: 'axios', label: 'axios' },
        { value: 'requests', label: 'Python requests' },
      ],
      default: 'fetch',
    },
    {
      key: 'prettyBody',
      label: 'Pretty-print JSON bodies',
      type: 'boolean',
      default: true,
    },
    {
      key: 'checkStatus',
      label: 'Add a non-2xx error check (fetch)',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'JSON POST',
      input:
        'curl -X POST https://api.example.com/users \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer token123\' \\\n  -d \'{"name":"Ada","admin":true}\'',
    },
    {
      title: 'Basic auth GET',
      input: "curl -u alice:secret 'https://example.com/data?page=2' -H 'Accept: application/json'",
    },
  ],
  faq: [
    {
      q: 'Which curl flags are understood?',
      a: 'The request-shaping flags: -X/--request, -H/--header, -d/--data/--data-raw/--data-binary/--data-urlencode, --url, -u/--user, -b/--cookie, -A/--user-agent, -e/--referer, -G, -I/--head and -F/--form. Fetch-affecting flags such as -L, -k, --compressed, -o and proxy options are reported in the notes because the generated snippet cannot carry them portably.',
    },
    {
      q: 'How is the HTTP method decided?',
      a: 'An explicit -X wins. Otherwise a body implies POST and -I implies HEAD; with none of those the request is a GET.',
    },
    {
      q: 'What happens to -d data?',
      a: 'If the data parses as JSON it is emitted as a pretty-printed object (with JSON.stringify for fetch) and a JSON content type is added when you did not set one. Otherwise it is emitted as a quoted string, and --data-urlencode values become URL-encoded form fields.',
    },
  ],
  related: [  "url-parse",
  "http-status",
  "json-format",
  "random-data"],
  status: 'stable',
};
