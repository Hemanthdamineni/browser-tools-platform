import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csr-decoder',
  name: 'CSR Decoder',
  category: 'crypto',
  summary:
    'Decode a PKCS#10 certificate request: subject, SANs, key details and a signature check.',
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
    {
      title: 'An EC request with DNS SANs',
      input:
        '-----BEGIN CERTIFICATE REQUEST-----\nMIIBOjCB4QIBADA9MRgwFgYDVQQDDA9hcGkuZXhhbXBsZS5jb20xFDASBgNVBAoM\nC0V4YW1wbGUgTHRkMQswCQYDVQQGEwJHQjBZMBMGByqGSM49AgEGCCqGSM49AwEH\nA0IABJyeRJCLLGfKzxkABpzuPjzEpHdwCr872706Yqt9e/e53ITS0Ucmo8KJKeWN\niYogbUHOylSJdj4dAPvAjXP/JdugQjBABgkqhkiG9w0BCQ4xMzAxMC8GA1UdEQQo\nMCaCD2FwaS5leGFtcGxlLmNvbYITd3d3LmFwaS5leGFtcGxlLmNvbTAKBggqhkjO\nPQQDAgNIADBFAiAXrl4bB9wCnYtguUCG+ZREQ+B23JDaQh40c9vTZnXvxgIhAL68\nuxjhvm53f7os1BokAMYk3toMiGOohjUgtAnsqf2x\n-----END CERTIFICATE REQUEST-----\n',
    },
    {
      title: 'An Ed25519 request',
      input:
        '-----BEGIN CERTIFICATE REQUEST-----\nMIGVMEkCAQAwFjEUMBIGA1UEAwwLZXhhbXBsZS5vcmcwKjAFBgMrZXADIQAguufu\n8uYXRnAc+yRgHBKdA5QcQPt10enzMDhlaWshnKAAMAUGAytlcANBAIqvoXaywQDZ\nJBMkQ0SHNybLg84g2Xl/+qDsHj7iPfETPnkmf2/uIdVUl9aiaOfs4/fVeWHQPVMF\nznMB9ZShzQc=\n-----END CERTIFICATE REQUEST-----\n',
    },
  ],
  related: ['x509-certificate-inspector', 'ssh-key-fingerprint', 'hex', 'json-format'],
  status: 'stable',
};
