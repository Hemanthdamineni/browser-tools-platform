import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'x509-certificate-inspector',
  name: 'X.509 Certificate Inspector',
  category: 'crypto',
  summary: 'Parse an X.509 certificate: subject, issuer, validity, key details, SANs and fingerprints.',
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
