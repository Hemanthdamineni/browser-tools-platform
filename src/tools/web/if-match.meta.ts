import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'if-match',
  name: 'If-Match Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP If-Match entity-tag conditions.',
  description:
    'Generate or analyze If-Match conditional request values for optimistic concurrency and lost-update prevention. Validates strong and weak entity-tag syntax, wildcard handling, duplicates, and safe conditional semantics locally.',
  keywords: [
    'If-Match',
    'ETag condition',
    'HTTP optimistic concurrency',
    'lost update prevention',
    'conditional request',
    'entity tag matcher',
    '412 precondition failed',
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
        { value: 'analyze', label: 'Analyze tags' },
        { value: 'build', label: 'Build condition' },
      ],
    },
    { key: 'tag', label: 'Entity tag', type: 'text', default: '"v1-abc123"' },
    { key: 'weak', label: 'Weak comparison tag', type: 'boolean', default: false },
    {
      key: 'wildcard',
      label: 'Match any current representation (*)',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { title: 'Analyze an update precondition', input: '"v1-abc123"' },
    { title: 'Build a strong If-Match condition', options: { mode: 'build', tag: '"v1-abc123"' } },
  ],
  faq: [
    {
      q: 'What does If-Match protect against?',
      a: 'It lets a client update only if the resource still has a matching entity tag, preventing accidental overwrites after another change.',
    },
    {
      q: 'Are weak tags valid for If-Match?',
      a: 'If-Match uses strong comparison, so weak entity-tags do not satisfy the condition. This tool accepts them for analysis but flags them for review.',
    },
    {
      q: 'What does * mean?',
      a: 'The wildcard matches any current representation, and is useful for operations that should proceed only when a resource exists.',
    },
  ],
  related: [  "conditional-request-headers",
  "http-range",
  "http-status"],
  hidden: true,
  redirectTo: 'conditional-request-headers',
  status: 'stable',
};
