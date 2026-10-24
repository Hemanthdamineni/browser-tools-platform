import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'pgp-tool',
  name: 'PGP Tool',
  category: 'security',
  summary:
    'Generate OpenPGP keys, and encrypt, decrypt, sign and verify text or files — fully on-device.',
  description:
    'A complete OpenPGP workbench built on openpgp.js: generate an Ed25519, NIST P-256 or RSA key pair, encrypt text or files to a public key, decrypt with a private key and passphrase, sign and verify messages (detached or clearsigned), and import or export keys. Everything runs in this tab; private keys are never uploaded and are only stored if you explicitly opt in to saving them in this browser.',
  keywords: [
    'pgp',
    'openpgp',
    'gpg',
    'encrypt',
    'decrypt',
    'sign',
    'verify',
    'public key',
    'private key',
    'fingerprint',
    'key generation',
    'pgp keygen',
    'armored',
    'clearsign',
    'detached signature',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  acceptsText: true,
  // The PGP flow is multi-step (key generation, import, encrypt/decrypt, sign/verify)
  // with its own per-mode fields, so it opts into the dedicated panel.
  panel: 'pgp-tool',
  options: [
    {
      key: 'mode',
      label: 'Action',
      type: 'select',
      default: 'generate',
      choices: [
        { value: 'generate', label: 'Generate a key pair' },
        { value: 'encrypt', label: 'Encrypt' },
        { value: 'decrypt', label: 'Decrypt' },
        { value: 'sign', label: 'Sign' },
        { value: 'verify', label: 'Verify' },
        { value: 'import', label: 'Import / export keys' },
      ],
    },
    {
      key: 'keyType',
      label: 'Key type',
      type: 'select',
      default: 'ed25519',
      showWhen: { key: 'mode', value: 'generate' },
      choices: [
        { value: 'ed25519', label: 'Ed25519 / Curve25519 (modern, fast)' },
        { value: 'nistp256', label: 'NIST P-256 (ECDSA + ECDH)' },
        { value: 'rsa2048', label: 'RSA 2048-bit' },
        { value: 'rsa4096', label: 'RSA 4096-bit' },
      ],
    },
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      default: '',
      placeholder: 'Ada Lovelace',
      showWhen: { key: 'mode', value: 'generate' },
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      default: '',
      placeholder: 'ada@example.com',
      showWhen: { key: 'mode', value: 'generate' },
    },
    {
      key: 'output',
      label: 'Ciphertext format',
      type: 'select',
      default: 'armored',
      showWhen: { key: 'mode', value: 'encrypt' },
      choices: [
        { value: 'armored', label: 'ASCII-armored text' },
        { value: 'binary', label: 'Binary file (.pgp)' },
      ],
    },
    {
      key: 'signatureStyle',
      label: 'Signature style',
      type: 'select',
      default: 'detached',
      showWhen: { key: 'mode', value: 'sign' },
      choices: [
        { value: 'detached', label: 'Detached signature (.asc)' },
        { value: 'clearsign', label: 'Clearsigned text' },
      ],
    },
  ],
  examples: [
    {
      title: 'Generate an Ed25519 key',
      options: {
        mode: 'generate',
        keyType: 'ed25519',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      },
    },
    {
      title: 'Generate an RSA 4096 key',
      options: { mode: 'generate', keyType: 'rsa4096', name: 'Bob', email: 'bob@example.com' },
    },
    {
      title: 'Generate a NIST P-256 key',
      options: {
        mode: 'generate',
        keyType: 'nistp256',
        name: 'Grace Hopper',
        email: 'grace@example.com',
      },
    },
  ],
  faq: [
    {
      q: 'Where do my keys live?',
      a: 'Only in your browser tab. Key generation, encryption and signing all happen locally with openpgp.js; nothing is uploaded and no server stores your keys. If you opt in, a generated private key can be saved to this browser\u2019s localStorage so it is convenient next time, but that is a choice you make per key and you can clear it at any time.',
    },
    {
      q: 'Are my messages interoperable with GnuPG or other PGP tools?',
      a: 'Yes. This tool produces standard OpenPGP armor and binary packets, so encrypted messages, signatures and keys work with GPG, Sequoia, Proton Mail and other OpenPGP implementations.',
    },
    {
      q: 'I lost my passphrase — can the key be recovered?',
      a: 'No. There is no backup, no recovery hint and no key escrow. The passphrase is the only thing that protects the private key, and a lost passphrase means the private key is permanently unusable. Keep your private key and passphrase somewhere safe, ideally offline.',
    },
    {
      q: 'Why does the tool ask for my private key?',
      a: 'Decrypting and signing require the private key, and we never send it anywhere — it is used in this tab and then left in your control. You can paste it each time, or (optionally) save it to this browser so the panel can pre-fill it.',
    },
  ],
  article: [
    {
      heading: 'Six actions in one OpenPGP workbench',
      body: 'Generate produces a fresh key pair from an Ed25519, NIST P-256, RSA 2048 or RSA 4096 curve with the name and email you enter, plus a passphrase if you set one, and returns the private key, public key, revocation certificate, key ID and fingerprint. Encrypt seals text or a file to the pasted public key and returns ASCII armor or a binary .pgp; decrypt opens a message or file with the private key and passphrase and reveals its text or writes back a file. Sign and verify round out the set, and import exports the public half of a private key so you can share it.',
    },
    {
      heading: 'How output is shaped',
      body: 'Every mode reports through the panel, and the report is JSON you can read: generate gives one object holding the fingerprint, key ID, user IDs and all three key artifacts; encrypt names the recipient’s user ID and fingerprint; decrypt notes whether the message carried a signature; verify prints a one-line verdict naming the signer; and import hands back the armored public key. Binary payloads — an encrypted file, a decrypted document, a detached signature — also download under a sensible name such as message.pgp or signature.asc.',
    },
    {
      heading: 'Interoperability and the shapes of a signature',
      body: 'The tool produces standard OpenPGP armor and binary packets, so encrypted messages, signatures and keys interoperate with GnuPG, Sequoia, Proton Mail and other implementations. A sign action can be detached, which writes a separate .asc signature you ship alongside the document, or clearsigned, which wraps the original text between BEGIN and END signature blocks so a reader can verify without a second file. A decrypted message that was signed names the signing key, and verify confirms the message was not altered after signing.',
    },
    {
      heading: 'Where the keys and your data live',
      body: 'Everything runs in this tab. openpgp.js is loaded lazily and the heavy crypto executes in a Web Worker, so the interface stays responsive, and no key and no message is sent to a server. Private keys are not stored unless you explicitly choose to save one to this browser’s localStorage, which is a per-key decision you can reverse by clearing site data — the default is that a generated key exists only for the session. A key with no passphrase is flagged as a warning, because anyone who obtains it can use it.',
    },
  ],
  related: ['ssh-key-fingerprint', 'text-encrypt', 'file-encrypt', 'x509-certificate-inspector'],
  credits: [
    {
      name: 'openpgp.js',
      url: 'https://openpgpjs.org/',
      license: 'LGPL-3.0+',
    },
  ],
  status: 'stable',
};
