import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'signature-input',
  name: 'Signature-Input Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Message Signature-Input fields.',
  description:
    'Generate or analyze Signature-Input structured fields for HTTP Message Signatures. Validates signature labels, covered components, created and expires timestamps, key identifiers, and algorithm parameters locally; it never signs or verifies messages.',
  keywords: [
    'Signature-Input',
    'HTTP Message Signatures',
    'structured fields',
    'covered components',
    'created timestamp',
    'keyid',
    'signature parameters',
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
        { value: 'analyze', label: 'Analyze field' },
        { value: 'build', label: 'Build field' },
      ],
    },
    { key: 'label', label: 'Signature label', type: 'text', default: 'sig1' },
    {
      key: 'components',
      label: 'Covered components (space-separated)',
      type: 'text',
      default: '@method @target-uri content-digest',
    },
    { key: 'keyid', label: 'Key identifier', type: 'text', default: 'service-key-1' },
    {
      key: 'created',
      label: 'Created Unix timestamp (optional)',
      type: 'number',
      default: 0,
      min: 0,
    },
  ],
  examples: [
    {
      title: 'Analyze signature parameters',
      input:
        'sig1=("@method" "@target-uri" "content-digest");created=1710000000;keyid="service-key-1"',
    },
    {
      title: 'Build a signature input',
      options: {
        mode: 'build',
        label: 'sig1',
        components: '@method @target-uri content-digest',
        keyid: 'service-key-1',
        created: 1710000000,
      },
    },
  ],
  related: ['http-header-analyzer', 'authorization'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
