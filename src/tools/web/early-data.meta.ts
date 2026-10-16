import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'early-data',
  name: 'Early-Data Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Early-Data replay signals.',
  description: 'Generate or analyze the Early-Data request header used with TLS 1.3 0-RTT. Validates the standardized 0 signal, explains 425 Too Early handling, and highlights replay and idempotency risks locally.',
  keywords: ['Early-Data', 'TLS 1.3 0-RTT', '425 Too Early', 'replay attack', 'HTTP early data', 'idempotent request', 'anti-replay'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze signal' }, { value: 'build', label: 'Build header' }] },
    { key: 'value', label: 'Early-Data value', type: 'text', default: '0' },
  ],
  examples: [
    { title: 'Analyze a 0-RTT request signal', input: '0' },
    { title: 'Build an Early-Data header', options: { mode: 'build', value: '0' } },
  ],
  faq: [
    { q: 'What does Early-Data: 0 mean?', a: 'It indicates that a request was sent in TLS 1.3 early data and may be replayed by an attacker or network path.' },
    { q: 'What is 425 Too Early?', a: 'A server can return 425 to ask the client to retry the request after the handshake, when replay safety cannot be established.' },
    { q: 'Does this make a request safe?', a: 'No. Applications must still use idempotency keys, reject unsafe replayable operations, and apply server-side anti-replay policy.' },
  ],
  related: ['http-status', 'retry-after', 'security-headers'],
  status: 'stable',
};
