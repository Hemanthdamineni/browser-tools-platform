import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'network-error-logging',
  name: 'Network-Error-Logging (NEL) Policy Builder',
  category: 'web',
  summary: 'Build or inspect NEL policies and report delivery.',
  description:
    'Generate or analyze the Network-Error-Logging response header policy JSON. Validates required report_to and max_age fields, the failure_mode enum, success_fraction range, and whether the referenced reporting endpoint exists.',
  keywords: [
    'Network-Error-Logging',
    'NEL',
    'network errors',
    'report_to',
    'failure_mode',
    'success_fraction',
    'error reporting',
    'browser reports',
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
        { value: 'analyze', label: 'Analyze policy JSON' },
        { value: 'build', label: 'Build policy JSON' },
      ],
    },
    { key: 'report_to', label: 'report_to (endpoint group)', type: 'text', default: 'default' },
    { key: 'max_age', label: 'max_age (seconds)', type: 'text', default: '2592000' },
    {
      key: 'include_subdomains',
      label: 'include_subdomains',
      type: 'select',
      default: 'true',
      choices: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ],
    },
    {
      key: 'failure_mode',
      label: 'failure_mode',
      type: 'select',
      default: 'fail-open',
      choices: [
        { value: 'fail-open', label: 'fail-open' },
        { value: 'fail-closed', label: 'fail-closed' },
      ],
    },
    { key: 'success_fraction', label: 'success_fraction (0-1)', type: 'text', default: '0' },
  ],
  examples: [
    {
      title: 'Analyze an NEL policy',
      input:
        '{"report_to":"default","max_age":2592000,"include_subdomains":true,"failure_mode":"fail-open","success_fraction":0.1}',
    },
    {
      title: 'Build an NEL policy',
      options: {
        mode: 'build',
        report_to: 'default',
        max_age: '2592000',
        failure_mode: 'fail-open',
      },
    },
  ],
  faq: [
    {
      q: 'What does NEL do?',
      a: 'It asks the browser to report network errors from this origin to the configured reporting endpoint, helping diagnose connectivity issues that bypass application code.',
    },
    {
      q: 'Which fields are required?',
      a: 'report_to and max_age are required. The rest are optional and take defaults per browser.',
    },
    {
      q: 'What does failure_mode choose?',
      a: 'fail-open retains default network behavior when delivery fails; fail-closed asks the browser to block the request outright.',
    },
  ],
  related: ['http-header-analyzer', 'security-headers'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
