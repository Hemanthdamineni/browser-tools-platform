import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'reporting-endpoints',
  name: 'Reporting-Endpoints Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect Reporting API endpoint groups.',
  description:
    'Generate or analyze the Reporting-Endpoints response header. Validates quoted endpoint URLs, priority parameters, duplicate group names, and the requirement that report URLs be HTTPS (or HTTP for localhost) for modern browsers.',
  keywords: [
    'Reporting-Endpoints',
    'Reporting API',
    'report-to',
    'endpoint groups',
    'CSP reports',
    'priority parameter',
    'error reporting',
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
        { value: 'analyze', label: 'Analyze endpoints' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'name', label: 'Group name', type: 'text', default: 'default' },
    {
      key: 'url',
      label: 'Report URL',
      type: 'text',
      default: 'https://reports.example.com/collect',
    },
    { key: 'priority', label: 'Priority (optional)', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Analyze endpoint groups',
      input: 'default="https://reports.example.com/collect"; priority=1',
    },
    {
      title: 'Build a default endpoint',
      options: { mode: 'build', name: 'default', url: 'https://reports.example.com/collect' },
    },
  ],
  faq: [
    {
      q: 'What is Reporting-Endpoints?',
      a: 'It is part of the Reporting API and configures where browsers should send reports such as CSP violations or deprecation warnings.',
    },
    {
      q: 'Does a group need HTTPS?',
      a: 'Reporting endpoints must be HTTPS in modern browsers; HTTP is permitted only for localhost origins.',
    },
    {
      q: 'What does priority control?',
      a: 'The optional priority parameter (0-255) controls connection pooling priority for the endpoint; it does not change report routing between groups.',
    },
  ],
  related: ['security-headers', 'content-security-policy', 'network-error-logging'],
  status: 'stable',
};
