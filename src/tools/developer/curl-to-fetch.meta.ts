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
    {
      title: 'URL-encoded form POST',
      input:
        "curl -X POST https://example.com/login \\\n  -d 'user=ada' --data-urlencode 'note=hello world'",
    },
  ],
  article: [
    {
      heading: 'What comes back',
      body: 'Paste a curl command, line continuations and quotes and all, and the tool prints the equivalent client code for the target you choose. JavaScript fetch produces a URL plus an options object with method, headers and body; axios produces the config-object style; Python requests produces a requests.request(...) call. Input is capped at 100,000 characters.',
    },
    {
      heading: 'How the request is reconstructed',
      body: 'The parser reads the request-shaping flags: -X for the method, -H for headers, the -d family for a body, -u for Basic auth, -b for cookies, -A for user-agent, -e for referer, -G to move data into the query string, -I for a HEAD and -F for multipart form fields. An explicit -X wins; otherwise a body implies POST and -I implies HEAD, and with neither the request is a GET.',
    },
    {
      heading: 'The three switches that matter',
      body: 'The target select picks the language and library. Pretty-print JSON bodies decides whether a JSON payload becomes an indented object or a single-line string, and the non-2xx error check adds fetch boilerplate that throws on a non-ok response, which is why generated fetch is longer than a bare one-liner.',
    },
    {
      heading: 'What it deliberately does not do',
      body: 'Anything that cannot survive into client code is reported as a note rather than dropped silently: -L, -k, --compressed, output and cookie-jar flags, timeouts, proxies, interfaces and unknown tokens all get an explicit warning, and a header without a colon is noted as ignored. The converter never executes, follows or even resolves the URL \u2014 it only rewrites your text, on your device, so the credentials inside it never leave the tab.',
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
  related: ['url-parse', 'http-status', 'json-format', 'random-data'],
  status: 'stable',
};
