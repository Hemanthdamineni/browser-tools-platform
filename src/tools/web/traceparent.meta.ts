import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'traceparent',
  name: 'Traceparent Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect W3C Traceparent propagation values.',
  description: 'Generate or analyze W3C Trace Context traceparent values. Validates version, 32-hex trace IDs, 16-hex parent IDs, and two-hex trace flags, rejects all-zero identifiers, and explains propagation and sampling semantics locally.',
  keywords: ['traceparent', 'W3C Trace Context', 'distributed tracing', 'trace ID', 'span ID', 'trace flags', 'OpenTelemetry'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze header' }, { value: 'build', label: 'Build header' }] },
    { key: 'version', label: 'Version', type: 'text', default: '00' },
    { key: 'traceId', label: 'Trace ID (32 hex)', type: 'text', default: '' },
    { key: 'parentId', label: 'Parent ID (16 hex)', type: 'text', default: '' },
    { key: 'flags', label: 'Trace flags (2 hex)', type: 'text', default: '01' },
  ],
  examples: [
    { title: 'Analyze a traceparent', input: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
    { title: 'Build a sampled traceparent', options: { mode: 'build', version: '00', traceId: '4bf92f3577b34da6a3ce929d0e0e4736', parentId: '00f067aa0ba902b7', flags: '01' } },
  ],
  faq: [
    { q: 'What does the sampled flag mean?', a: 'The least-significant bit of trace flags indicates that the trace may be sampled; it is a propagation hint, not a guarantee that data was collected.' },
    { q: 'Can I invent a trace ID?', a: 'Use a random 16-byte trace ID and 8-byte parent ID in production. This tool validates supplied values but does not generate randomness.' },
    { q: 'Does this contact a tracing backend?', a: 'No. It only validates and formats header text locally.' },
  ],
  related: ['server-timing', 'forwarded-header', 'user-agent'],
  status: 'stable',
};
