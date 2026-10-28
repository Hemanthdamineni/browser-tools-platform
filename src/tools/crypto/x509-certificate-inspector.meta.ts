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
        '-----BEGIN CERTIFICATE-----\nMIIDDTCCAfWgAwIBAgIUIzbRrIBVwVq+cqJKWzBoa4cWZaIwDQYJKoZIhvcNAQEL\nBQAwFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wHhcNMjYxMDI3MDc1OTQ5WhcNMjYx\nMTI2MDc1OTQ5WjAWMRQwEgYDVQQDDAtleGFtcGxlLmNvbTCCASIwDQYJKoZIhvcN\nAQEBBQADggEPADCCAQoCggEBAK6J/1F7RGZFJNIuikBr3vDaKH6in9TiaAR5ya1y\n1ITCJovAabo3JoKbje6/XLPQi7mvcKQxgy24WjWwpqC6PkhpJqulHOcwwD2i8Cb3\nBft6TipPi3IR3ukuxL0LIu0ndTJsvt5SQa5BHFVJEXAgelUrTNwdwLITd/P6eCDv\n0HIDPkYXACA16Lg7GBzPutJMQr8wy3FMSk+B+Ojhucxoy0X2VbzAAwj55FgsZFU1\npXOVcv0pM13mZsiUWLgGcMwRLygpeVDmEg4ZbQ/B7Z1pbWImjPHvzuI9/vRZzzgZ\nUNBnzrXZnQYpV4JpWM+/L29Lp55vI2pzHGSeuUWVKRvr3Q8CAwEAAaNTMFEwHQYD\nVR0OBBYEFDg1uyV73MiuOhpaPl5KNNCJMvWUMB8GA1UdIwQYMBaAFDg1uyV73Miu\nOhpaPl5KNNCJMvWUMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEB\nAKaYOo5qqTsgAydaiRnyUEVBsfdFQ7oHKZV6t27+PjNSwW1ZbZIjKPhdjCp0xUic\nS53RHVvr3kpN4ivL5+toOzibXME2oSG5eiVmU5wztiAlPflncBakmfHCNH/loC1f\nuPkyRNBu8Np4kSm5Sxxea83Rq4JJx+h1NasbDXZYD5teeGRpjuiLVzDGppH5bOtJ\nEqg+jHFoOWZrQuICC81unObqbMD/G23ZtH9QktVE0DB5UCR5X/E8TscMTAtbu90p\nnsrmj+nOD5LlB35csL5xgphikN0o5WD7766Csh2KpGOaVrLlg1NwW+u3gIoOLnMq\nS6H6MWicyWlmW9IXSAfEMGY=\n-----END CERTIFICATE-----',
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
  related: [  "ssh-key-fingerprint",
  "hash",
  "text-encrypt"],
  status: 'stable',
};
