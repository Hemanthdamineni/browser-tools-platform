import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cache-headers',
  name: 'Cache Headers Builder & Analyzer',
  category: 'web',
  summary:
    'Build or analyze Cache-Control, CDN-Cache-Control, Surrogate-Control, Expires, Age, Cache-Status, and Vary.',
  description:
    'One tool for every cache-related HTTP header. Pick a family, then build a validated header value from its directives or paste an existing value to inspect it for invalid, duplicate, and conflicting directives. Everything runs locally.',
  keywords: [
    'cache headers',
    'Cache-Control builder',
    'cache header analyzer',
    'CDN-Cache-Control',
    'Surrogate-Control',
    'Expires header',
    'Age header',
    'Cache-Status RFC 9211',
    'Vary header',
    'HTTP caching',
    'no-store',
    'max-age',
    's-maxage',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'header',
      label: 'Header to build or analyze',
      type: 'select',
      default: 'cache-control',
      choices: [
        { value: 'cache-control', label: 'Cache-Control (general HTTP caching)' },
        { value: 'cdn-cache-control', label: 'CDN-Cache-Control' },
        { value: 'surrogate-control', label: 'Surrogate-Control (reverse proxies / ESI)' },
        { value: 'expires', label: 'Expires (HTTP-date)' },
        { value: 'age', label: 'Age (cache residency seconds)' },
        { value: 'cache-status', label: 'Cache-Status (RFC 9211 debug field)' },
        { value: 'vary', label: 'Vary (cache-key request fields)' },
      ],
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze a pasted header value' },
        { value: 'build', label: 'Build a header value' },
      ],
    },
    // Cache-Control build fields
    {
      key: 'visibility',
      label: 'Visibility',
      type: 'select',
      default: 'public',
      showWhen: { key: 'header', value: 'cache-control' },
      choices: ['public', 'private'].map((value) => ({ value, label: value })),
    },
    {
      key: 'maxAge',
      label: 'max-age seconds (0 = omit)',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'header', value: 'cache-control' },
    },
    {
      key: 'sMaxAge',
      label: 's-maxage seconds (0 = omit)',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'header', value: 'cache-control' },
    },
    {
      key: 'noStore',
      label: 'no-store',
      type: 'boolean',
      default: false,
      showWhen: { key: 'header', value: 'cache-control' },
    },
    {
      key: 'noCache',
      label: 'no-cache',
      type: 'boolean',
      default: false,
      showWhen: { key: 'header', value: 'cache-control' },
    },
    {
      key: 'mustRevalidate',
      label: 'must-revalidate',
      type: 'boolean',
      default: false,
      showWhen: { key: 'header', value: 'cache-control' },
    },
    {
      key: 'immutable',
      label: 'immutable',
      type: 'boolean',
      default: false,
      showWhen: { key: 'header', value: 'cache-control' },
    },
    {
      key: 'staleWhileRevalidate',
      label: 'stale-while-revalidate seconds (0 = omit)',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'header', value: 'cache-control' },
    },
    // CDN-Cache-Control
    {
      key: 'cdnDirectives',
      label: 'CDN-Cache-Control directives',
      type: 'text',
      default: '',
      placeholder: 'max-age=3600, stale-while-revalidate=60',
      showWhen: { key: 'header', value: 'cdn-cache-control' },
    },
    // Surrogate-Control
    {
      key: 'surrogateDirectives',
      label: 'Surrogate-Control directives',
      type: 'text',
      default: '',
      placeholder: 'max-age=3600, content="ESI/1.0"',
      showWhen: { key: 'header', value: 'surrogate-control' },
    },
    // Expires
    {
      key: 'date',
      label: 'Expiration date (IMF-fixdate)',
      type: 'text',
      default: '',
      placeholder: 'Wed, 21 Oct 2030 07:28:00 GMT',
      showWhen: { key: 'header', value: 'expires' },
    },
    // Age
    {
      key: 'seconds',
      label: 'Age in seconds',
      type: 'text',
      default: '',
      placeholder: '120',
      showWhen: { key: 'header', value: 'age' },
    },
    // Cache-Status
    {
      key: 'cc',
      label: 'Cache-Status cache-name',
      type: 'text',
      default: '',
      placeholder: 'CDN',
      showWhen: { key: 'header', value: 'cache-status' },
    },
    {
      key: 'hit',
      label: 'Cache-Status result',
      type: 'select',
      default: 'hit',
      showWhen: { key: 'header', value: 'cache-status' },
      choices: [
        { value: 'hit', label: 'hit' },
        { value: 'miss', label: 'miss' },
        { value: 'pass', label: 'pass' },
      ],
    },
    {
      key: 'ttl',
      label: 'Cache-Status ttl seconds',
      type: 'text',
      default: '',
      placeholder: '60',
      showWhen: { key: 'header', value: 'cache-status' },
    },
    {
      key: 'fwd',
      label: 'Cache-Status forwarding reason',
      type: 'text',
      default: '',
      placeholder: 'urlll',
      showWhen: { key: 'header', value: 'cache-status' },
    },
    // Vary
    {
      key: 'fields',
      label: 'Vary request fields (comma-separated)',
      type: 'text',
      default: '',
      placeholder: 'Accept-Encoding, Origin',
      showWhen: { key: 'header', value: 'vary' },
    },
  ],
  examples: [
    { title: 'Analyze a Cache-Control policy', input: 'public, max-age=31536000, immutable' },
    {
      title: 'Build a private no-store policy',
      options: {
        header: 'cache-control',
        mode: 'build',
        visibility: 'private',
        noStore: true,
        noCache: true,
        mustRevalidate: true,
      },
    },
    {
      title: 'Analyze a CDN-Cache-Control policy',
      input: 'max-age=3600, stale-while-revalidate=60',
      options: { header: 'cdn-cache-control' },
    },
    {
      title: 'Build a Surrogate-Control policy',
      options: {
        header: 'surrogate-control',
        mode: 'build',
        surrogateDirectives: 'max-age=3600, content="ESI/1.0"',
      },
    },
    {
      title: 'Analyze an RFC 9211 Cache-Status field',
      input: 'CDN; hit; ttl=60; stored',
      options: { header: 'cache-status' },
    },
    {
      title: 'Build a normalized Vary value',
      options: { header: 'vary', mode: 'build', fields: 'Accept-Encoding, Origin' },
    },
  ],
  article: [
    {
      heading: 'Seven cache fields behind one pair of controls',
      body: 'Pick a header family: Cache-Control, CDN-Cache-Control, Surrogate-Control, Expires, Age, Cache-Status or Vary. Analyze mode parses the pasted value into a table of directive names, values and assessments, one row per directive. Build mode composes a value from the option fields and prints ready-to-paste HTTP. "public, max-age=31536000, immutable" returns three unflagged rows.',
    },
    {
      heading: 'When pasting a live header beats re-reading the RFCs',
      body: 'Reach for it when a response misbehaves: a CDN serves last week HTML, an API is refetched on every click, a shared cache stores what you expected to be private. Copy the header from the network panel, pick the family, paste. You see the directives actually sent, not what the configuration file intended.',
    },
    {
      heading: 'What the build fields do, and what a zero means',
      body: 'Cache-Control build emits visibility first, then no-store, no-cache, max-age, s-maxage, must-revalidate, immutable and stale-while-revalidate; a zero lifetime omits the directive rather than writing max-age=0, and fractional lifetimes are refused. Elsewhere CDN-Cache-Control and Surrogate-Control read raw directive text and reject invalid, duplicated or empty-valued tokens, Expires demands IMF-fixdate, Age takes a second count, Cache-Status joins name, result, ttl and forwarding reason, and Vary lowercases field names while refusing a wildcard beside names.',
    },
    {
      heading: 'What the local checks can and cannot prove',
      body: 'The analyzer flags no-store beside a freshness lifetime, private with public, immutable without max-age, repeated directives, and obsolete or past Expires dates, and refuses input over 100 KB. It cannot say whether the content is safe to cache or whether a CDN honours the field.',
    },
    {
      heading: 'Your production headers stay in this tab',
      body: 'Parsing and composing both run in the page, so the pasted values and the generated line never reach a server, which matters when the header came from an internal host.',
    },
  ],
  faq: [
    {
      q: 'Why is this one tool instead of seven?',
      a: 'Cache-Control, CDN-Cache-Control, Surrogate-Control, Expires, Age, Cache-Status, and Vary are all cache-related response fields. The older single-header tools now redirect to this one; their URLs still work.',
    },
    {
      q: 'Does no-cache mean do not store?',
      a: 'No. no-cache allows storage but requires validation before reuse. Use no-store when a response must not be stored.',
    },
    {
      q: 'Can this know whether a response is safe to cache?',
      a: 'No. It can flag suspicious combinations such as public caching with contradictory directives, but cache safety depends on content, authorization, and deployment context.',
    },
    {
      q: 'Does a CDN have to honor these fields?',
      a: 'Only if the CDN supports the field and its documented precedence rules. Treat provider-specific fields as advisory unless the provider documents otherwise.',
    },
  ],
  related: ['conditional-request-headers', 'http-header-analyzer'],
  status: 'beta',
};
