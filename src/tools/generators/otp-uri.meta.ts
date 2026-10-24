import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'otp-uri',
  name: 'OTP Auth URI Generator',
  category: 'generators',
  summary: 'Build otpauth:// URIs (TOTP/HOTP) with a base32 secret for authenticator apps.',
  description:
    'Create the otpauth:// provisioning URI that Google Authenticator, Aegis, 1Password and friends scan as a QR code. Generates a random base32 secret on-device or validates one you paste in.',
  keywords: [
    'otpauth',
    'totp',
    'hotp',
    '2fa',
    'two factor',
    'authenticator',
    'base32 secret',
    'otp uri',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      default: 'totp',
      choices: [
        { value: 'totp', label: 'TOTP (time-based)' },
        { value: 'hotp', label: 'HOTP (counter-based)' },
      ],
    },
    { key: 'issuer', label: 'Issuer', type: 'text', default: 'Toolbench' },
    { key: 'account', label: 'Account', type: 'text', default: 'user@example.com' },
    {
      key: 'secretInput',
      label: 'Secret (base32, empty = generate)',
      type: 'text',
      default: '',
      placeholder: 'e.g. JBSWY3DPEHPK3PXP',
    },
    {
      key: 'secretBytes',
      label: 'Random secret bytes',
      type: 'number',
      default: 20,
      min: 16,
      max: 64,
    },
    {
      key: 'digits',
      label: 'Code digits',
      type: 'select',
      default: '6',
      choices: [
        { value: '6', label: '6' },
        { value: '8', label: '8' },
      ],
    },
    {
      key: 'algorithm',
      label: 'Hash algorithm',
      type: 'select',
      default: 'SHA1',
      choices: [
        { value: 'SHA1', label: 'SHA1 (default)' },
        { value: 'SHA256', label: 'SHA256' },
        { value: 'SHA512', label: 'SHA512' },
      ],
    },
    {
      key: 'period',
      label: 'Period (seconds)',
      type: 'number',
      default: 30,
      min: 15,
      max: 120,
      showWhen: { key: 'type', value: 'totp' },
    },
    {
      key: 'counter',
      label: 'Initial counter',
      type: 'number',
      default: 0,
      showWhen: { key: 'type', value: 'hotp' },
    },
  ],
  article: [
    {
      heading: 'Building the URI an authenticator scans',
      body: 'This generates an otpauth:// provisioning URI for TOTP or HOTP. It either produces a fresh secret with crypto.getRandomValues and encodes it as unpadded RFC 4648 base32, or validates and normalises a base32 secret you paste. The output is the URI itself plus a "Secret (base32)" line for apps that cannot scan a QR code.',
    },
    {
      heading: 'Enrolment for a service you are building',
      body: 'Use it to construct the enrolment link or QR payload for your own app, to check that the URI your backend produced is well-formed before shipping, or to mint a secret for a test account. Hand the output to any QR generator and the authenticator picks up the issuer, account and parameters.',
    },
    {
      heading: 'The parameters that matter',
      body: 'Type switches between time-based TOTP, which uses Period (15–120 s, default 30), and counter-based HOTP, which uses Initial counter instead. Issuer and Account shape the label the user sees. Secret (base32, empty = generate) lets you supply your own; otherwise Random secret bytes (16–64, default 20) decides the entropy. Code digits selects 6 or 8 and Hash algorithm SHA1, SHA256 or SHA512.',
    },
    {
      heading: 'Caveats',
      body: 'The tool builds the URI only — it never computes a live code, so a 6-digit value from anywhere else is not from here. Issuer and account are percent-encoded in the path and the parameters are URL-encoded, as the Key URI Format requires. A pasted secret must use only A–Z and 2–7 with optional padding, and any padding is stripped before use.',
    },
    {
      heading: 'Generated on your device',
      body: "The random secret comes from the browser's cryptographic random source and never leaves the page; no URI or secret is uploaded. Treat a 2FA secret like a password anyway, because whoever holds it can generate your codes.",
    },
  ],
  examples: [
    {
      title: 'TOTP with a fresh secret',
      options: { type: 'totp', issuer: 'Toolbench', account: 'you@example.com' },
    },
    {
      title: 'Known secret',
      options: { type: 'totp', issuer: 'ACME', account: 'alice', secretInput: 'JBSWY3DPEHPK3PXP' },
    },
    {
      title: 'HOTP with a counter',
      options: { type: 'hotp', issuer: 'ACME', account: 'alice', counter: 5, digits: '8' },
    },
  ],
  faq: [
    {
      q: 'Does this show my current 6-digit code?',
      a: 'No — this tool builds the provisioning URI only. Computing a live code needs the current time and HMAC; pair the URI with the QR Code Generator to enrol in your authenticator app.',
    },
    {
      q: 'Is my secret safe?',
      a: 'It is generated in your browser with crypto.getRandomValues and never leaves the device. Still, treat any 2FA secret like a password: anyone who has it can generate your codes.',
    },
    {
      q: 'Which parameters do authenticator apps actually read?',
      a: 'Almost all of them read secret, issuer and account, and TOTP apps also honour digits, algorithm and period. HOTP apps need counter. Some older clients ignore the algorithm parameter and assume SHA1, so a SHA256 URI may not scan correctly everywhere.',
    },
  ],
  related: ['qr-code', 'random-string', 'hmac'],
  status: 'stable',
};
