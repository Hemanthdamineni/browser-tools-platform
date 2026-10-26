/**
 * Editorial content for the pgp-tool tool page.
 *
 * Kept out of ``pgp-tool.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
