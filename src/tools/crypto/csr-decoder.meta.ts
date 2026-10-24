import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csr-decoder',
  name: 'CSR Decoder',
  category: 'crypto',
  summary: 'Decode a PKCS#10 certificate request: subject, SANs, key details and a signature check.',
  description:
    'Paste a certificate signing request (PEM or DER) and read exactly what a CA would see: the subject fields in order, every requested subjectAltName with its type, the public key algorithm, curve and size, the requested extensions and whether they are critical, the signature algorithm, and a real cryptographic check that the request is signed by the key it carries. A findings list flags problems before you sign it.',
  keywords: [
    'csr decoder',
    'certificate signing request',
    'pkcs#10',
    'openssl req',
    'subjectaltname',
    'csr viewer',
    'x509 request',
    'san dns names',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.csr,.pem,.req,.txt,application/pkcs10,application/x-pem-file,text/plain',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'subject', label: 'Subject fields' },
        { value: 'extensions', label: 'Requested extensions' },
        { value: 'findings', label: 'Findings' },
      ],
      default: 'summary',
    },
    {
      key: 'verifySignature',
      label: 'Verify the signature',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A request with SANs and key usage',
      input:
        '-----BEGIN CERTIFICATE REQUEST-----\nMIIDMjCCAhoCAQAwaTELMAkGA1UEBhMCR0IxDzANBgNVBAgMBkxvbmRvbjEPMA0G\nA1UEBwwGTG9uZG9uMRQwEgYDVQQKDAtFeGFtcGxlIEx0ZDEMMAoGA1UECwwDT3Bz\nMRQwEgYDVQQDDAtleGFtcGxlLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCC\nAQoCggEBAKNOx86QghDfXtJ9VYhQou2aqp1Ue/O9JHld9JZOxD1GpHhL+If9elW4\nOpjB8MwcssYVQqdiZqJ/1jiz5QDSjogUNDc9LykPeMx1XoctSo5ML2m3yjlzEOAq\noVOgtydm3FE9XgKF70oXDNVJ9RiTEjzup+KUHtJzWoKuLMkGemqd3O8qFm7ojxl6\nVJUfpmQV+T2alz4yfYza+6wXcL0jXlTAaOHu5RhB2kMSPirYMTXDOVKtgb5lfwwY\nOUIuG07KsGUYoAVfuMJsey+ASgRPf7KuI6qExX47jhCoBA2hUyABfklIMvil2nCy\nsZwa3m455vIYTBrwlVkhIktdO1LYNq0CAwEAAaCBgzCBgAYJKoZIhvcNAQkOMXMw\ncTBABgNVHREEOTA3ggtleGFtcGxlLmNvbYIPd3d3LmV4YW1wbGUuY29thwTAAAIK\ngRFhZG1pbkBleGFtcGxlLmNvbTAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYI\nKwYBBQUHAwEGCCsGAQUFBwMCMA0GCSqGSIb3DQEBCwUAA4IBAQAsCMfyay3sduBp\nanae8rBVnIKtdLa2lrSJh07r5qvlV9mGzxgG9JZUfCMrF/yc3vy+/QgC0583k/c1\nAPhe1BVvsjAtFGE7+hyX1ic3Af3w7ZE1nLt9u7fvQ77RrSZPZ5B2B2CsRBEN7pdS\nqJnbjOHTXnUeFv3pKbyZRwUROlv0TRvAT4KQUgxt8lm0cCX2noUbWpHaENcTM4JK\nQbBtkip/2BjCRGp/tPRb/FInqpUMZg36wY9O0RTvQyoDn3m1LSrburmGtdV/Xfgi\nplvlHiEh/vB1vNdlqnCg4Zm184+CRwbQ+yDinarT7bhHYPa6vs6Z8kLKyyPFvB9m\n9VvYKgpd\n-----END CERTIFICATE REQUEST-----',
    },
  ],
  faq: [
    {
      q: 'What does the signature check prove?',
      a: 'A PKCS#10 request is signed with the private key that matches the public key inside it. If the signature verifies, the request is intact and whoever sent it holds that private key. It says nothing about whether the requester is entitled to the names they asked for.',
    },
    {
      q: 'Why is a certificate rejected with a hint?',
      a: 'Certificates and requests are different structures. If you paste a certificate the tool says so rather than showing nonsense, and the X.509 Certificate Inspector in this collection decodes that instead.',
    },
    {
      q: 'Which key types are understood?',
      a: 'RSA (with the modulus bit length), EC keys with a named curve such as prime256v1 or secp384r1, and Ed25519 and Ed448. Unknown algorithms are still listed by OID so you can look them up.',
    },
    {
      q: 'Is the request sent anywhere?',
      a: 'No. The DER is parsed in this page and the signature is checked with the browser WebCrypto API using the public key already inside the request, so nothing leaves your device.',
    },
  ],
  related: ['x509-certificate-inspector', 'ssh-key-fingerprint', 'hex', 'json-format'],
  status: 'stable',
};
