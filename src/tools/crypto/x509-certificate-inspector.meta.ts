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
        '-----BEGIN CERTIFICATE-----\nMIICyTCCAjKgAwIBAgIULJ1+KEaZwrqWmGpN673Cn4IK9hswDQYJKoZIhvcNAQEL\nBQAwYjELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0V4YW1wbGUxFDASBgNVBAcMC1Nw\ncmluZ2ZpZWxkMRUwEwYDVQQKDAxFeGFtcGxlIENvcnAxFDASBgNVBAMMC2V4YW1w\nbGUuY29tMB4XDTI2MTAyNjEyMjYxM1oXDTM2MTAyMzEyMjYxM1owYjELMAkGA1UE\nBhMCVVMxEDAOBgNVBAgMB0V4YW1wbGUxFDASBgNVBAcMC1NwcmluZ2ZpZWxkMRUw\nEwYDVQQKDAxFeGFtcGxlIENvcnAxFDASBgNVBAMMC2V4YW1wbGUuY29tMIGfMA0G\nCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDuNmxGE/JosLx69ZkKtGajN8enukMH3xk8\neIusOM6/jACxRFuJ7R5CJQsYI8C0yiOf39uWQlDL90ayRvHxr0WZTqU9JBe66TOD\nTyhkMCZ7dWdZL10jPre1l/fHLA1GbueKFgAdhISOi1r/ZY0X6iP6gLjb2RuAwCU/\nHi80FNRDXQIDAQABo3wwejAdBgNVHQ4EFgQUFg9keJjQOyYvVXcqqURJGKWCCq4w\nHwYDVR0jBBgwFoAUFg9keJjQOyYvVXcqqURJGKWCCq4wDwYDVR0TAQH/BAUwAwEB\n/zAnBgNVHREEIDAeggtleGFtcGxlLmNvbYIPd3d3LmV4YW1wbGUuY29tMA0GCSqG\nSIb3DQEBCwUAA4GBAM5G1jJ9HE4EeMogxXQUWHznlCWbidY1Ki82HQ2JOcXn5Zgx\n4sCPOLdB/OvBBw2ct3vN4r+dhg84Ji/DUxxOWb+Orsbas+7IOII38ExZEgueyqIr\nu+38l4R50sVqHEb1wFp8DxerG3yzTiB9hWXBGNODZjoq0O8/W4pKUWGSIA7p\n-----END CERTIFICATE-----',
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
  related: ['ssh-key-fingerprint', 'hash', 'text-encrypt'],
  status: 'stable',
};
