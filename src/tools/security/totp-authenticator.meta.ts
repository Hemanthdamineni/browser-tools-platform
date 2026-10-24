import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'totp-authenticator',
  name: 'TOTP Authenticator Code Generator',
  category: 'security',
  summary: 'Generate and verify RFC 6238 TOTP codes from a base32 secret.',
  description:
    'Compute time-based one-time passwords exactly like an authenticator app: paste the base32 secret that your otpauth:// URI contains, pick digits (standard 6) and a time step, and read the current, previous and next one-time codes with remaining seconds. The implementation is a self-contained SHA-1/HMAC and runs entirely in your browser — no requests, no history.' +
    ' A verify mode checks a code against the current 30-second window with a small tolerance so clock drift is handled.',
  keywords: [
    'TOTP',
    'one-time password',
    '2FA',
    'authenticator',
    'base32 secret',
    'RFC 6238',
    'multi-factor',
    'google authenticator',
    'time-based otp',
    '2 step verification',
    'otp code',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'codes',
      choices: [
        { value: 'codes', label: 'Generate codes' },
        { value: 'verify', label: 'Verify a code' },
      ],
    },
    {
      key: 'digits',
      label: 'Digits',
      type: 'select',
      default: '6',
      choices: [
        { value: '6', label: '6' },
        { value: '8', label: '8' },
      ],
    },
    {
      key: 'period',
      label: 'Period (seconds)',
      type: 'select',
      default: '30',
      choices: [
        { value: '30', label: '30' },
        { value: '60', label: '60' },
      ],
    },
  ],
  examples: [
    { title: 'Generate codes', input: 'JBSWY3DPEHPK3PXP' },
    {
      title: 'Generate 8-digit codes on a 60-second period',
      input: 'JBSWY3DPEHPK3PXP',
      options: { mode: 'codes', digits: '8', period: '60' },
    },
    {
      title: 'Check a code against the secret',
      input: 'JBSWY3DPEHPK3PXP 123456',
      options: { mode: 'verify' },
    },
  ],
  article: [
    {
      heading: 'The secret is the input',
      body: 'TOTP works from a shared secret, not from an account name. Paste the base32 string that sits after secret= in an otpauth:// URI — something like JBSWY3DPEHPK3PXP — and the tool computes the codes for the current, previous and next time window, with the seconds left in the current one. Spaces in the secret are ignored, so a grouped or pasted-with-gaps string still works.',
    },
    {
      heading: 'Generating versus verifying',
      body: 'In codes mode you get a three-row table: the current code with its remaining lifetime, the previous window and the next one. In verify mode the input is the secret followed by the code to check, separated by a space, and the result row says Valid or Invalid and explains which window matched. The tolerance is one step either side of now, so a code typed just as the window rolls over still verifies.',
    },
    {
      heading: 'Digits and period',
      body: 'Standard TOTP is six digits on a 30-second period, which is what most services issue; eight digits and a 60-second period are less common but supported. Both must match whatever the issuer used — a six-digit code checked as eight will never match, and a service on a 60-second step will appear to reject a 30-second code.',
    },
    {
      heading: 'Clock drift and the base32 format',
      body: 'TOTP depends on the clock. If every code you generate is rejected, check the device time first — the ±1 step tolerance covers a few seconds, not minutes. The secret must be valid base32 (A–Z and 2–7 only); padding and spaces are tolerated, but any other character is refused with a message rather than producing a wrong code.',
    },
    {
      heading: 'Nothing is stored or sent',
      body: 'The HMAC-SHA-1 is computed with the browser WebCrypto API entirely in this tab. No request is made, and the secret is not saved between visits — which is what you want for a second factor, since a caching authenticator is a liability. Keep a real authenticator app or a secure backup of the secret as well.',
    },
  ],
  faq: [
    {
      q: 'Where do I find the secret?',
      a: 'Scan or open the otpauth:// URI your service provides; the secret is the base32 string after "secret=".',
    },
    {
      q: 'Does this replace my authenticator app?',
      a: 'Conveniently yes on this machine, but keep a real app or secure backup of your secrets too, since codes are generated on launch and nothing is stored.',
    },
    {
      q: 'Why is my verify failing?',
      a: 'Check the secret (base32 without spaces), digits, and that your device clock is roughly correct — the window tolerance covers a few seconds of drift.',
    },
  ],
  related: ['otp-uri', 'password', 'hmac'],
  status: 'stable',
};
