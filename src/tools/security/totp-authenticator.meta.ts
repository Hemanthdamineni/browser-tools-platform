import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'totp-authenticator',
  name: 'TOTP Authenticator Code Generator',
  category: 'security',
  summary: 'Generate and verify RFC 6238 TOTP codes from a base32 secret.',
  description: 'Compute time-based one-time passwords exactly like an authenticator app: paste the base32 secret that your otpauth:// URI contains, pick digits (standard 6) and a time step, and read the current, previous and next one-time codes with remaining seconds. The implementation is a self-contained SHA-1/HMAC and runs entirely in your browser — no requests, no history.'
    + ' A verify mode checks a code against the current 30-second window with a small tolerance so clock drift is handled.',
  keywords: ['TOTP', 'one-time password', '2FA', 'authenticator', 'base32 secret', 'RFC 6238', 'multi-factor', 'google authenticator', 'time-based otp', '2 step verification', 'otp code'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'codes', choices: [{ value: 'codes', label: 'Generate codes' }, { value: 'verify', label: 'Verify a code' }] },
    { key: 'digits', label: 'Digits', type: 'select', default: '6', choices: [{ value: '6', label: '6' }, { value: '8', label: '8' }] },
    { key: 'period', label: 'Period (seconds)', type: 'select', default: '30', choices: [{ value: '30', label: '30' }, { value: '60', label: '60' }] },
  ],
  examples: [
    { title: 'Generate codes', input: 'JBSWY3DPEHPK3PXP' },
  ],
  faq: [
    { q: 'Where do I find the secret?', a: 'Scan or open the otpauth:// URI your service provides; the secret is the base32 string after "secret=".' },
    { q: 'Does this replace my authenticator app?', a: 'Conveniently yes on this machine, but keep a real app or secure backup of your secrets too, since codes are generated on launch and nothing is stored.' },
    { q: 'Why is my verify failing?', a: 'Check the secret (base32 without spaces), digits, and that your device clock is roughly correct — the window tolerance covers a few seconds of drift.' },
  ],
  related: ['otp-uri', 'password', 'hmac'],
  status: 'stable',
};
