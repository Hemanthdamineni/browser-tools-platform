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
  related: ['http-header-analyzer'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
