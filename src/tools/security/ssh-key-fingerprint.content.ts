/**
 * Editorial content for the ssh-key-fingerprint tool page.
 *
 * Kept out of ``ssh-key-fingerprint.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Two fingerprints for one key',
      body: 'Paste a public key — a .pub file, a line from authorized_keys, or the ssh-rsa AAAA... block — and the tool parses the OpenSSH blob and reports the modern SHA256 base64 fingerprint alongside the classic MD5 colon-hex form, plus the key type, bit size and any trailing comment.',
    },
    {
      heading: 'Confirming the key you installed is the key you meant',
      body: 'After copying a key to a server, compare the fingerprint shown here with the one the server reports: identical fingerprints mean it is the same key. It is the same check when verifying a host key against a printed fingerprint, or comparing a deploy key stored in two places.',
    },
    {
      heading: 'Why there is nothing to configure',
      body: 'A fingerprint is a function of the key, so there are no options. The base64 blob is decoded, the internal key type and modulus are read to derive the bit size, and the blob is hashed with SHA-256 for the modern form and MD5 for the legacy one. For RSA keys the size comes from the modulus; for Ed25519 the type fixes it.',
    },
    {
      heading: 'Caveats',
      body: 'Only the public key is needed; a private key will not work. Supported types are ssh-rsa, ssh-ed25519, the ecdsa-sha2-nistp256/384/521 family, ssh-dss and the sk- variants. Surrounding whitespace is trimmed, and a line that is not a recognisable public key is rejected.',
    },
    {
      heading: 'Computed locally',
      body: 'The blob is decoded and hashed in your browser and the key is never uploaded. Public keys are not secret, but keeping the check local means you can compare fingerprints without pasting them into a third-party service.',
    },
  ],
  faq: [
    {
      q: 'What does the fingerprint verify?',
      a: 'Two keys produce identical fingerprints only if they are the same key. After copying a key to a server, compare the fingerprint shown here with the one your server reports to confirm they match.',
    },
    {
      q: 'Which fingerprint should I use?',
      a: 'Modern OpenSSH (and GitHub) use the SHA256 form by default — start with that. The MD5 form is the older classic fingerprint and is still shown by some systems.',
    },
    {
      q: 'Is my private key needed?',
      a: 'No. Only the public key (the .pub file or the ssh-rsa/ssh-ed25519/ecdsa line) is required — never paste a private key.',
    },
    {
      q: 'What key types are supported?',
      a: 'ssh-rsa, ssh-ed25519, ecdsa-sha2-nistp256 (and the nistp384/521 variants), ssh-dss, and the sk- prefixed security-key variants.',
    },
  ],
} as const;
