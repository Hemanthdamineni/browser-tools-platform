import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'priority-header',
  name: 'Priority Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Priority scheduling parameters.',
  description:
    'Generate or analyze the RFC 9218 Priority field for HTTP/2 and HTTP/3. Validates urgency and incremental parameters, detects duplicates and unknown members, and makes clear that priority is a scheduling hint rather than a delivery guarantee.',
  keywords: [
    'Priority header',
    'HTTP/2 priority',
    'HTTP/3 priority',
    'urgency',
    'incremental',
    'RFC 9218',
    'request scheduling',
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
        { value: 'analyze', label: 'Analyze priority' },
        { value: 'build', label: 'Build priority' },
      ],
    },
    { key: 'urgency', label: 'Urgency (0–7)', type: 'number', default: 3, min: 0, max: 7 },
    { key: 'incremental', label: 'Incremental delivery', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'Analyze a priority value', input: 'u=1, i' },
    {
      title: 'Build a high-priority request',
      options: { mode: 'build', urgency: 1, incremental: false },
    },
  ],
  faq: [
    {
      q: 'Does urgency 0 guarantee first delivery?',
      a: 'No. It expresses relative urgency to the server and intermediary scheduler; congestion, dependencies, and implementation policy still decide delivery.',
    },
    {
      q: 'What does i mean?',
      a: 'The incremental parameter indicates that incremental delivery is acceptable for the response, such as progressively loading a resource.',
    },
    {
      q: 'Is this the old HTTP/2 dependency tree?',
      a: 'No. This uses the modern RFC 9218 Priority field syntax rather than obsolete HTTP/2 priority trees.',
    },
  ],
  related: [  "http-status",
  "content-type",
  "http-header-analyzer"],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
