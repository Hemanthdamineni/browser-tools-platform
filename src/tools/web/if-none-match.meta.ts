import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'if-none-match',
  name: 'If-None-Match Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP If-None-Match conditions.',
  description: 'Generate or analyze If-None-Match entity-tag conditions for cache revalidation and create-if-absent requests. Validates strong and weak tags, wildcard handling, duplicates, and method-sensitive semantics entirely on-device.',
  keywords: ['If-None-Match', 'HTTP cache validation', '304 Not Modified', 'create if absent', 'entity tag condition', 'conditional request'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze tags' }, { value: 'build', label: 'Build condition' }] },
    { key: 'tag', label: 'Entity tag', type: 'text', default: '"v1-abc123"' },
    { key: 'weak', label: 'Weak comparison tag', type: 'boolean', default: false },
    { key: 'wildcard', label: 'Match any current representation (*)', type: 'boolean', default: false },
    { key: 'method', label: 'Request method', type: 'select', default: 'GET', choices: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'].map((value) => ({ value, label: value })) },
  ],
  examples: [
    { title: 'Analyze cache revalidation', input: 'W/"v1-abc123"' },
    { title: 'Build a create-if-absent condition', options: { mode: 'build', wildcard: true, method: 'PUT' } },
  ],
  faq: [
    { q: 'What happens when a GET tag matches?', a: 'The server commonly returns 304 Not Modified without the response body, allowing the client to reuse its cached representation.' },
    { q: 'What does * mean for PUT?', a: 'It commonly means proceed only when no current representation exists, supporting create-if-absent workflows.' },
    { q: 'Are weak tags allowed?', a: 'Yes. If-None-Match uses weak comparison, so weak tags can participate in cache validation.' },
  ],
  related: ['etag', 'if-match', 'cache-control'],
  status: 'stable',
};
