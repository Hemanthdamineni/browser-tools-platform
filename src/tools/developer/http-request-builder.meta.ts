import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'http-request-builder',
  name: 'HTTP Request Builder',
  category: 'developer',
  summary:
    'Compose a raw HTTP/1.1 request — method, URL, headers and body — with Host and Content-Length filled in.',
  description:
    'Assemble a raw HTTP/1.1 request line by line: pick a method, an absolute or relative URL, optional headers and a body. The tool derives the path and query, sets a Host header from the URL (or accepts your own), computes Content-Length when you send a body, and renders a complete request you can paste into a socket client, netcat, or a debugging proxy.',
  keywords: [
    'http request builder',
    'raw http request',
    'craft http request',
    'http request composer',
    'request line generator',
    'http debugging',
    'netcat request',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      choices: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((v) => ({
        value: v,
        label: v,
      })),
      default: 'GET',
    },
    {
      key: 'url',
      label: 'URL (absolute or path)',
      type: 'text',
      default: 'https://api.example.com/items?page=1',
      placeholder: 'https://example.com/path?q=1',
    },
    {
      key: 'version',
      label: 'HTTP version',
      type: 'select',
      choices: [
        { value: '1.1', label: 'HTTP/1.1' },
        { value: '1.0', label: 'HTTP/1.0' },
      ],
      default: '1.1',
    },
    {
      key: 'headers',
      label: 'Extra headers (one "Name: value" per line)',
      type: 'textarea',
      default: '',
      placeholder: 'Accept: application/json',
    },
    {
      key: 'body',
      label: 'Body (optional)',
      type: 'textarea',
      default: '',
    },
    {
      key: 'autoLength',
      label: 'Add Content-Length from body',
      type: 'boolean',
      default: true,
    },
    {
      key: 'addHost',
      label: 'Add Host header from URL',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A JSON POST',
      input: '',
      options: {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: 'Content-Type: application/json',
        body: '{"name":"Ada"}',
      },
    },
    {
      title: 'A GET with a custom header',
      input: '',
      options: {
        method: 'GET',
        url: 'https://api.example.com/items?page=1',
        headers: 'Accept: application/json\nX-API-Key: abc123',
      },
    },
    {
      title: 'A relative request against HTTP/1.0',
      input: '',
      options: {
        method: 'DELETE',
        url: '/items/42',
        version: '1.0',
        addHost: false,
      },
    },
  ],
  article: [
    {
      heading: 'The wire request, not a client',
      body: 'Choose a method from the seven supported verbs, type an absolute or relative URL, add optional headers one per line and a body, and the tool returns the raw HTTP/1.1 message — request line, headers, blank line and body — as text to copy. It renders a request; it does not fire anything over the network.',
    },
    {
      heading: 'When hand-rolling a request makes sense',
      body: 'Use it to reproduce a request for a socket client, netcat, a debugging proxy or a raw TCP repl, or to capture exactly what your server will see on the wire. For building a fetch or curl command you would reach for curl-to-fetch or curl-to-code instead, since those produce code, not bytes.',
    },
    {
      heading: 'How Host and Content-Length get filled',
      body: 'A Host header is derived from the URL origin when the option is on and you have not supplied one; switching it off drops the header entirely. Content-Length is computed from the encoded body bytes when a body is present, the method is not GET or HEAD, and you have not defined it — both can be overridden with your own header lines.',
    },
    {
      heading: 'Edge cases worth knowing',
      body: 'URLs are capped at two hundred thousand characters, and only GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS are accepted. A relative path keeps your own Host header when you supply one. Line endings in the body are normalised to CRLF so the emitted message is byte-accurate for most servers.',
    },
    {
      heading: 'Requests are built, not sent',
      body: 'Everything happens on this device — no request is transmitted, nothing is logged and the composed text is yours to copy.',
    },
  ],
  faq: [
    {
      q: 'What exactly do I get?',
      a: 'A raw HTTP/1.1 message: the request line (METHOD path?query HTTP/1.1), headers, an empty line, and the body. Suitable for debugging proxies, socket tools and netcat.',
    },
    {
      q: 'How are Host and Content-Length handled?',
      a: 'Host is taken from the URL origin unless you already define it; Content-Length is set from the body bytes when present (both can be overridden or disabled with the options).',
    },
    {
      q: 'Is this the same as a code generator?',
      a: 'No — this emits the raw wire-format request text. Tools like curl-to-fetch or curl-to-code generate programming-language snippets instead.',
    },
  ],
  related: ['curl-to-fetch', 'curl-to-code', 'http-status', 'http-range'],
  status: 'stable',
};
