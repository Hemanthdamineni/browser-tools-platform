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
  related: ['http-status', 'basic-auth', 'mime-lookup', 'url-parse'],
  status: 'stable',
};
