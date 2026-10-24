import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'bcrypt',
  name: 'BCrypt Hash / Verify',
  category: 'security',
  summary: 'Hash a password with bcrypt, or verify a password against a stored hash.',
  description:
    'Turn a password into a bcrypt hash with a chosen cost factor (work factor), or check a password against a stored hash. Everything runs locally in a Web Worker so the page stays responsive even at high cost, and the password never leaves your device.',
  keywords: [
    'bcrypt',
    'hash',
    'password hash',
    'password verify',
    'cost factor',
    'rounds',
    'bcrypt hash',
    'check password',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  worker: true,
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'hash',
      choices: [
        { value: 'hash', label: 'Hash a password' },
        { value: 'verify', label: 'Verify against a hash' },
      ],
    },
    {
      key: 'cost',
      label: 'Cost factor (rounds)',
      type: 'range',
      default: 10,
      min: 4,
      max: 15,
      step: 1,
      help: 'Work factor. Each +1 doubles the time. Default 10 ≈ 0.1 s.',
      showWhen: { key: 'mode', value: 'hash' },
    },
    {
      key: 'hash',
      label: 'Stored bcrypt hash',
      type: 'text',
      default: '',
      placeholder: '$2b$10$…',
      showWhen: { key: 'mode', value: 'verify' },
    },
  ],
  examples: [
    {
      title: 'Hash a password at the default cost',
      input: 'hunter2',
      options: { mode: 'hash', cost: 10 },
    },
    {
      title: 'Hash with a higher cost factor',
      input: 'correct horse battery staple',
      options: { mode: 'hash', cost: 12 },
    },
    {
      title: 'Verify a matching password',
      input: 'hunter2',
      options: {
        mode: 'verify',
        hash: '$2b$10$EZHlFIQcLaXBPdVq9vdDC.OFujeyPmE613GmGj.itHbjbhCYA8J.2',
      },
    },
  ],
  faq: [
    {
      q: 'Is my password sent anywhere?',
      a: 'No. Hashing and verification run entirely in your browser inside a Web Worker. The password is never transmitted, logged, or stored by this page.',
    },
    {
      q: 'What cost factor should I use?',
      a: 'The default 10 is a reasonable baseline (roughly 0.1 s). Higher values (12–15) resist brute force better but are noticeably slower; the tool shows an estimated time for the cost you choose.',
    },
    {
      q: 'What does a bcrypt hash look like?',
      a: 'A bcrypt hash starts with $2a$, $2b$, $2x$ or $2y$, followed by a two-digit cost and a 53-character payload. For example: $2b$10$EZHlFIQcLaXBPdVq9vdDC.OFujeyPmE613GmGj.itHbjbhCYA8J.2.',
    },
  ],
  article: [
    {
      heading: 'What bcrypt hashing does',
      body: 'bcrypt turns a password into a 60-character hash that also embeds a random salt and the cost factor that produced it. Because the salt is part of the output, the same password hashed twice gives two different strings, which defeats precomputed rainbow tables. The stored value is safe to keep in a database exactly as shown.',
    },
    {
      heading: 'Choosing a cost factor',
      body: 'The cost factor is the base-2 logarithm of the number of key-expansion rounds, so every increment doubles the work for both the defender and an attacker. A cost of 10 is the common default and takes about a tenth of a second; 12 to 14 is a sensible target for modern hardware, while 15 can take several seconds. The tool prints a rough estimate for whichever cost you pick.',
    },
    {
      heading: 'Verifying an existing hash',
      body: 'Switch to verify mode, paste the password in the input box and the stored hash in the option field. bcrypt re-reads the salt and cost from the hash itself, so you never have to supply them separately. The result is a clear match or no-match answer; a malformed hash is rejected with a helpful message rather than a silent failure.',
    },
    {
      heading: 'Why the work runs in a worker',
      body: 'bcrypt is deliberately CPU-heavy, so at higher costs the calculation would freeze the page if it ran on the main thread. This tool runs it in a Web Worker, meaning the interface stays responsive, progress can be shown, and you can cancel a long run. Nothing is uploaded: the worker is a thread inside your own browser tab.',
    },
  ],
  related: ['password-strength', 'passphrase', 'password', 'file-hash'],
  credits: [{ name: 'bcryptjs', url: 'https://github.com/dcodeIO/bcrypt.js', license: 'MIT' }],
  status: 'stable',
};