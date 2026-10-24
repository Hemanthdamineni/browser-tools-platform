import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cors-headers',
  name: 'CORS Headers Builder & Analyzer',
  category: 'web',
  summary: 'Build a full CORS policy or analyze pasted Access-Control-* response headers.',
  description:
    'Create any Access-Control-* response header from one form, or paste a CORS response to check it. Validates origins, method and header tokens, the wildcard-with-credentials conflict, and preflight cache time — all on your device.',
  keywords: [
    'CORS headers',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers',
    'Access-Control-Expose-Headers',
    'Access-Control-Max-Age',
    'cross-origin resource sharing',
    'preflight',
    'wildcard credentials',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze headers' },
        { value: 'build', label: 'Build headers' },
      ],
    },
    {
      key: 'target',
      label: 'What to build',
      type: 'select',
      default: 'all',
      showWhen: { key: 'mode', value: 'build' },
      choices: [
        { value: 'all', label: 'A full CORS policy' },
        { value: 'allow-origin', label: 'Access-Control-Allow-Origin' },
        { value: 'allow-credentials', label: 'Access-Control-Allow-Credentials' },
        { value: 'allow-methods', label: 'Access-Control-Allow-Methods' },
        { value: 'allow-headers', label: 'Access-Control-Allow-Headers' },
        { value: 'expose-headers', label: 'Access-Control-Expose-Headers' },
        { value: 'max-age', label: 'Access-Control-Max-Age' },
      ],
    },
    {
      key: 'origin',
      label: 'Allowed origin',
      type: 'text',
      default: 'https://app.example.com',
      help: 'Use * or one full http(s) origin. Not a list.',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'credentials',
      label: 'Allow credentials (cookies, auth)',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'methods',
      label: 'Allowed methods (comma-separated)',
      type: 'text',
      default: 'GET, POST, PUT, DELETE',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'headers',
      label: 'Allowed request headers (comma-separated)',
      type: 'text',
      default: 'Content-Type, Authorization',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'expose',
      label: 'Exposed response headers (comma-separated)',
      type: 'text',
      default: 'X-Request-Id, X-Rate-Limit',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'maxAge',
      label: 'Preflight cache seconds',
      type: 'text',
      default: '600',
      help: 'How long browsers may cache a preflight response.',
      showWhen: { key: 'mode', value: 'build' },
    },
  ],
  examples: [
    {
      title: 'Build a full credentialed CORS policy',
      options: {
        mode: 'build',
        target: 'all',
        origin: 'https://app.example.com',
        credentials: true,
        methods: 'GET, POST',
        headers: 'Content-Type, Authorization',
        expose: 'X-Request-Id',
        maxAge: '600',
      },
    },
    {
      title: 'Analyze a CORS response',
      input:
        'Access-Control-Allow-Origin: https://app.example.com\nAccess-Control-Allow-Credentials: true\nAccess-Control-Allow-Methods: GET, POST\nAccess-Control-Max-Age: 600',
    },
    { title: 'Analyze a wildcard grant', input: '*' },
  ],
  article: [
    {
      heading: 'One tool for the whole Access-Control-* family',
      body: 'CORS is a set of response headers, and getting one wrong usually surfaces as an opaque browser error. This tool covers them all: Allow-Origin, Allow-Credentials, Allow-Methods, Allow-Headers, Expose-Headers and Max-Age. Build mode emits the ones you need as copyable lines; analyze mode reads a pasted response and tells you what each header permits and which values are invalid.',
    },
    {
      heading: 'Building a policy',
      body: 'Pick a target — a full policy or a single header — and fill the values in. The origin field takes * or one full http(s) origin, not a list, because the header itself carries a single value. Methods and headers are comma-separated lists validated as HTTP tokens. The output is a set of header lines with notes, such as the reminder to add Vary: Origin when the origin is chosen per request.',
    },
    {
      heading: 'The wildcard-with-credentials trap',
      body: 'The most common CORS mistake is combining Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true. That combination is forbidden: once credentials are allowed, the origin must name the specific caller and cannot be a wildcard, and the same applies to * in Allow-Methods, Allow-Headers and Expose-Headers. The builder refuses to emit the bad combination and the analyzer flags it.',
    },
    {
      heading: 'Analyzing an existing response',
      body: 'Paste the raw header lines from a devtools panel and each recognised header becomes a row with its value, a Valid or Invalid status and a plain-English assessment. Duplicate lines, malformed tokens and a wildcard used with credentials are called out. A bare number falls back to a Max-Age check and any other bare string to an Allow-Origin check, so a single value is easy to verify.',
    },
    {
      heading: 'Checked on your device',
      body: 'Validation and generation are pure string handling in this tab — no request is sent, so a real origin list or an internal hostname stays private. The tool needs no network at all.',
    },
  ],
  faq: [
    {
      q: 'Can Access-Control-Allow-Origin be * with credentials?',
      a: 'No. When Access-Control-Allow-Credentials: true is set, the allowed origin must name the specific requesting origin and cannot be a wildcard.',
    },
    {
      q: 'Why add Vary: Origin?',
      a: 'If the allowed origin is chosen per request, Vary: Origin stops caches serving one caller the origin grant meant for another.',
    },
    {
      q: 'Which methods trigger a preflight?',
      a: 'GET, HEAD, and POST with simple headers are sent directly; most other methods and headers trigger an OPTIONS preflight answered with Allow-Methods and Allow-Headers.',
    },
  ],
  related: ['security-headers', 'http-header-analyzer', 'cross-origin-resource-policy'],
  status: 'beta',
};
