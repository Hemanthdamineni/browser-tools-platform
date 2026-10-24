import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'x509-certificate-inspector',
  name: 'X.509 Certificate Inspector',
  category: 'crypto',
  summary:
    'Parse an X.509 certificate: subject, issuer, validity, key details, SANs and fingerprints.',
  description:
    'Paste a PEM-encoded X.509 certificate (the text between -----BEGIN CERTIFICATE----- and -----END CERTIFICATE-----) and get a complete on-device breakdown: subject and issuer distinguished names, serial number, signature algorithm, validity dates plus days remaining, the public key (type, bit size and RSA modulus/exponent or EC curve), subject alternative names (DNS/IP), CA/basic-constraints flags, key identifiers, and SHA-256/SHA-1 fingerprints. No network request is made and the certificate never leaves your browser. Useful for checking why a TLS connection is untrusted, verifying certificate details after renewal, or auditing a chain.',
  keywords: [
    'x509',
    'certificate',
    'cert',
    'ssl',
    'tls',
    'pem',
    'subject',
    'issuer',
    'san',
    'certificate inspector',
    'cer',
    'crl',
    'public key',
    'certificate check',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    {
      title: 'Certificate details',
      input:
        '-----BEGIN CERTIFICATE-----\nMIID/DCCAuSgAwIBAgIUTnVaXxVzi9vZDzYpqiLQgcpK/vEwDQYJKoZIhvcNAQEL\nBQAweTELMAk...XjQ==\n-----END CERTIFICATE-----',
    },
    {
      title: 'Check for expiry',
      input:
        '-----BEGIN CERTIFICATE-----\nMIIB...replace with your own PEM...\n-----END CERTIFICATE-----',
    },
    {
      title: 'Read the SAN list',
      input:
        '-----BEGIN CERTIFICATE-----\nMIIB...paste a server certificate here...\n-----END CERTIFICATE-----',
    },
  ],
  article: [
    {
      heading: 'What comes out of a certificate',
      body: 'Paste the PEM block and the tool returns a table: subject and issuer names, serial number, signature algorithm, both validity dates with a status and days remaining, the public key type and size (RSA modulus and exponent, or EC curve), the embedded extensions, and both a SHA-256 and SHA-1 fingerprint of the whole DER bytes.',
    },
    {
      heading: 'A concrete debugging situation',
      body: 'A browser reports a certificate date error after a renewal and you want to know what the server actually sent. Export it, paste it here, and the Validity status and Days remaining answer it immediately. The same table tells you whether the SAN list still covers the hostname, the other common cause of a name mismatch.',
    },
    {
      heading: 'Reading the parts that matter',
      body: 'The fingerprints are computed over the whole DER certificate, so they match what a trust store or a pinning config shows. The extensions section reports key usage, basic constraints, subject and authority key identifiers and the subject alternative names. Unknown OIDs are listed by their dotted form rather than hidden.',
    },
    {
      heading: 'What it deliberately does not do',
      body: 'This parses one certificate; it does not build or validate a chain, check a signature against a trusted root or consult a revocation list. Those need a trust store and network access. A self-signed certificate therefore shows matching subject and issuer, which is expected rather than an error.',
    },
    {
      heading: 'No certificate leaves the tab',
      body: 'The Base64 is decoded, the ASN.1 walked and the hashes computed with the WebCrypto API, all locally. Nothing is uploaded and no network request is made, so an internal or pre-production certificate can be inspected safely.',
    },
  ],
  faq: [
    {
      q: 'Why would a certificate show as expired?',
      a: 'Certificates are only valid between the Not Before and Not After dates. The inspector compares your current local time to those bounds and reports the status, including how many days remain.',
    },
    {
      q: 'Does this validate the certificate chain?',
      a: 'No — this parses a single certificate. Chain building and trust validation require trusted root stores and are outside the scope of a local text tool.',
    },
    {
      q: 'Which key types are supported?',
      a: 'RSA (bit size and modulus/exponent), ECDSA (curve), Ed25519 and DSA. Unknown OIDs are still reported by their dotted OID form.',
    },
  ],
  related: ['ssh-key-fingerprint', 'hash', 'text-encrypt'],
  status: 'stable',
};
