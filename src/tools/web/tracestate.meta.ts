import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'tracestate',
  name: 'Tracestate Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect W3C Trace Context tracestate values.',
  description:
    'Generate or analyze W3C tracestate propagation values. Validates vendor keys and values, detects duplicates, enforces the 32-entry and 512-byte limits, and explains vendor-specific trace metadata locally.',
  keywords: [
    'tracestate',
    'W3C Trace Context',
    'distributed tracing',
    'vendor key',
    'trace propagation',
    'OpenTelemetry',
    'trace metadata',
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
        { value: 'analyze', label: 'Analyze state' },
        { value: 'build', label: 'Build state' },
      ],
    },
    { key: 'key', label: 'Vendor key', type: 'text', default: 'vendor' },
    { key: 'value', label: 'Vendor value', type: 'text', default: 'opaque-value' },
  ],
  examples: [
    { title: 'Analyze vendor state', input: 'vendor=opaque-value,congo=t61rcWkgMzE' },
    {
      title: 'Build a vendor entry',
      options: { mode: 'build', key: 'vendor', value: 'opaque-value' },
    },
  ],
  faq: [
    {
      q: 'What belongs in tracestate?',
      a: 'Vendors use it for implementation-specific trace metadata while preserving other vendors’ entries during propagation.',
    },
    {
      q: 'Is tracestate confidential?',
      a: 'It may reveal vendor identifiers or routing metadata. Avoid putting secrets or sensitive user data in it.',
    },
    {
      q: 'How large can it be?',
      a: 'The W3C format limits tracestate to 32 list-members and 512 bytes.',
    },
  ],
  related: ['traceparent', 'server-timing', 'forwarded-header'],
  status: 'stable',
};
