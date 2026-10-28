import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'security-headers',
  name: 'HTTP Security Headers Analyzer',
  category: 'security',
  summary: 'Review pasted HTTP response headers for common browser security protections.',
  description:
    'Analyze a raw HTTP response header block for CSP, HSTS, framing protection, MIME sniffing, referrer policy, and permissions policy. Results are heuristic guidance, not a complete security audit. No request is made to any host.',
  keywords: [
    'security headers analyzer',
    'http response headers security',
    'CSP checker',
    'content security policy analyzer',
    'HSTS checker',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'referrer policy checker',
    'permissions policy',
    'web security audit headers',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    {
      title: 'Review response headers',
      input:
        "HTTP/1.1 200 OK\nContent-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin",
    },
    {
      title: 'Review a minimal block',
      input: 'HTTP/1.1 200 OK\nServer: example',
    },
  ],
  faq: [
    {
      q: 'Does this scan a website?',
      a: 'No. Paste response headers yourself. The tool never makes a network request and cannot verify which headers a live server actually sends.',
    },
    {
      q: 'Does a passing result mean my site is secure?',
      a: 'No. This is a narrow, heuristic review of selected response headers. Security depends on application behavior, deployment, browser support, and many other controls.',
    },
    {
      q: 'Why might a header be marked for review?',
      a: 'Some policies depend on context. For example, HSTS should only be sent over HTTPS and CSP needs to match the resources your application actually uses. Read the suggestions before changing production settings.',
    },
  ],
  related: [  "http-status",
  "basic-auth",
  "jwt-decode"],
  status: 'stable',
};
