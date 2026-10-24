import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'curl-to-code',
  name: 'cURL to Code',
  category: 'developer',
  summary: 'Turn a curl command into ready-to-run code for 12 languages and frameworks.',
  description:
    'Paste any curl command and get equivalent, idiomatic code for JavaScript fetch, axios, Node.js, Python requests, Go, PHP, Ruby, Java, C#, Rust, PowerShell or a raw HTTP/1.1 request. It understands -X, -H, -d, --json, -F, -u, -b, -G, -I and more, and everything is parsed in your browser.',
  keywords: [
    'curl to code',
    'curl to fetch',
    'curl to python',
    'convert curl command',
    'curl to axios',
    'http request generator',
    'curl to go',
    'curl to javascript',
    'curl converter',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'target',
      label: 'Output format',
      type: 'select',
      default: 'fetch',
      choices: [
        { value: 'fetch', label: 'JavaScript — fetch' },
        { value: 'axios', label: 'JavaScript — axios' },
        { value: 'node', label: 'Node.js — https' },
        { value: 'python', label: 'Python — requests' },
        { value: 'go', label: 'Go — net/http' },
        { value: 'php', label: 'PHP — cURL' },
        { value: 'ruby', label: 'Ruby — Net::HTTP' },
        { value: 'java', label: 'Java — HttpClient' },
        { value: 'csharp', label: 'C# — HttpClient' },
        { value: 'rust', label: 'Rust — reqwest' },
        { value: 'powershell', label: 'PowerShell — Invoke-RestMethod' },
        { value: 'http', label: 'Raw HTTP/1.1 request' },
      ],
    },
  ],
  examples: [
    { title: 'Simple GET', input: 'curl https://api.github.com/repos/curl/curl' },
    {
      title: 'POST with JSON and a header',
      input:
        'curl -X POST https://api.example.com/v1/items \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer TOKEN\' \\\n  -d \'{"name":"widget","qty":3}\'',
    },
    {
      title: 'Basic auth, follow redirects',
      input: 'curl -u user:pass -L https://httpbin.org/basic-auth/user/pass',
    },
    {
      title: 'Multipart upload',
      input: 'curl -F name=holiday -F file=@photo.png https://upload.example.com',
    },
  ],
  faq: [
    {
      q: 'Which curl flags are understood?',
      a: 'The request-shaping flags: -X/--request, -H/--header, -d/--data*, --json, -F/--form, -u/--user, -b/--cookie, -A/--user-agent, -e/--referer, -G/--get, -I/--head, -T/--upload-file, -L/--location, -k/--insecure, --compressed, -m/--max-time and -x/--proxy. Other flags are ignored, and genuinely transport-specific ones (custom certificates, --resolve) are reported as notes rather than silently dropped.',
    },
    {
      q: 'Why do file uploads show a TODO comment?',
      a: 'A curl command only contains a path such as @photo.png. The browser cannot read that local file from a pasted command, so the generated code marks where the File/Blob or stream should be supplied — the multipart structure and field names are still correct.',
    },
    {
      q: 'Is my command sent anywhere?',
      a: 'No. Parsing and code generation run entirely in your browser tab. Commands often contain tokens and cookies, so trim or rotate any secrets before sharing generated snippets.',
    },
  ],
  article: [
    {
      heading: 'What it does',
      body: 'Paste a curl command and it is parsed into a small request model, then rendered as idiomatic code for JavaScript fetch, axios, Node https, Python requests, Go, PHP, Ruby, Java, C#, Rust, PowerShell, or a raw HTTP/1.1 request. The output is a code block whose language matches the chosen target, plus a request.txt or request.http filename and stats for the method, target, header count and body kind.',
    },
    {
      heading: 'When to use it',
      body: 'Use it when a docs page or a browser network tab shows a curl one-liner but you work in another language. Reproduce that exact request in your stack instead of hand-translating each flag, header and data body.',
    },
    {
      heading: 'The target option',
      body: 'The single option, target, picks the generator. Each language has its own escaping and library calls: fetch builds on Request and Headers, Python uses requests, Go uses net/http, and http emits a literal request block you can replay. Changing the target only changes how the same parsed request is rendered.',
    },
    {
      heading: 'Edge cases and limits',
      body: 'File uploads from -F only carry a local path such as @photo.png, so the generated multipart code marks where you must supply the File or Blob; the field names stay correct. Transport-specific flags like custom certificates become notes rather than being dropped, while unrecognised flags are ignored. Commands over 200,000 characters are rejected.',
    },
    {
      heading: 'Privacy',
      body: 'Parsing and code generation run entirely in this tab, so nothing is uploaded and the tool works offline. Since curl commands often hold tokens and cookies, trim or rotate any secrets before sharing the generated snippet.',
    },
  ],
  related: ['http-status', 'basic-auth', 'mime-lookup', 'url-parse'],
  status: 'stable',
};
