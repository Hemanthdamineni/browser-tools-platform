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
      title: 'Check the validity window',
      input:
        '-----BEGIN CERTIFICATE-----\nMIIDOzCCAiOgAwIBAgIUW9097JzO0c1DuZ0dNm+vTOJtXZEwDQYJKoZIhvcNAQEL\nBQAwLTEUMBIGA1UEAwwLZXhhbXBsZS5jb20xFTATBgNVBAoMDEV4YW1wbGUgQ29y\ncDAeFw0yNjEwMjgxNjQxMzNaFw0yNjExMjcxNjQxMzNaMC0xFDASBgNVBAMMC2V4\nYW1wbGUuY29tMRUwEwYDVQQKDAxFeGFtcGxlIENvcnAwggEiMA0GCSqGSIb3DQEB\nAQUAA4IBDwAwggEKAoIBAQDIgDkUyTPUV+5EHOHi5pUvXO0oLgXaZTNxenS6TRHO\nBivFof7XHVLzLmfFc/SYuzJB1+31pm+glWPkBI/8aogmYd2H8gWiiuUrzSaPOGhg\nB/OSCVtGujeJXoDPySyw3fea6BpHhs+wV69JGdYK5cG4+ZfKLMWT0muhC+YSMDA6\nXQI79EHBPyfd5JSM2mtsP8NwnLdJMRD0HHhnUmajxJMpK5Hy2eOXlTeBy+KLVWRv\naJ8I0FzXrMr6Foml1y4mCDi111+e/iMUy9lM5Sb3ne0Yw8PeCWP2IekG8+RhxwYA\nrVIMb/+D8wXNsRkTEt7qoJkdMiHzlp4oHl+IVEPKxZRHAgMBAAGjUzBRMB0GA1Ud\nDgQWBBQTz6AYDnk+FEFAHEa7q8iwDF5mxDAfBgNVHSMEGDAWgBQTz6AYDnk+FEFA\nHEa7q8iwDF5mxDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQBh\nHVUFnAeC9LxZNzgK8CUVzcO/butvmrQIgxUkrpwZwend5zdKmvXlIXoQ2W/jug9J\nxGcwLYqdQS5/7r55naY2TpYMT25IAcVnVwxgaxFyoF8NXVl6Npw0NXGRD39YTgF4\nXzby5JXbl4M7+Lqj0qLO2lUIfFYOc9d+2AxRZgrOmrYWcsMeNS0Tx7Gqjxo11i/E\nKv7EQLCyjigA5EnKBQAXHa5/AJaMUdIzmLHA64suAOwv44Aeqpxz/iRscWvgW7KK\na3Hvyc42v8AG9q+H5N3tKwrKU9klUJRDl83AZjfVyp0Cxcm7dYKD8iEuN/zuLnmv\nVnSQPJBr0pwowK7eCpeF\n-----END CERTIFICATE-----',
    },
    {
      title: 'Read the SAN list',
      input:
        '-----BEGIN CERTIFICATE-----\nMIIDdDCCAlygAwIBAgIUQ6Xp4hMMwKZpoQNHgzj6zv3WlQgwDQYJKoZIhvcNAQEL\nBQAwMTEYMBYGA1UEAwwPd3d3LmV4YW1wbGUuY29tMRUwEwYDVQQKDAxFeGFtcGxl\nIENvcnAwHhcNMjYxMDI4MTY0MTA4WhcNMjYxMTI3MTY0MTA4WjAxMRgwFgYDVQQD\nDA93d3cuZXhhbXBsZS5jb20xFTATBgNVBAoMDEV4YW1wbGUgQ29ycDCCASIwDQYJ\nKoZIhvcNAQEBBQADggEPADCCAQoCggEBALL+yBChvf9AP33q++xPTXH6uHv8N5QH\nH6ze0i2lB7u7+bpKmhIsBaD4kdAYuxtJ3iVvWYKusBTpN42bNsEJ8WwLrMtAiImR\nwk08PsEGBD+oNbJvhqJnd4TG+bv6h6dNYATFS1kc3TeitfcXXxOw16kt1IC2W/K7\njC4hxjXnX1WQVNDsDDjFUIWWbVlMGDOWZsg8s+kvLWaeEcxuIPLDcH7ddLUPlzzO\nC9vksJgBCi+zhq0jnq0qPmZtpwNsi2kNpcmtx9aq3d8td9SID8YtM3o/oWK0UT13\nw5DMOYpzUMD1AWR1Hrsak//LeQJ5qlRFy8pi/RaGtWbOABtqaKk3RucCAwEAAaOB\ngzCBgDAdBgNVHQ4EFgQUZ150DNNL/ngiBbru7jzEc+3BhfkwHwYDVR0jBBgwFoAU\nZ150DNNL/ngiBbru7jzEc+3BhfkwDwYDVR0TAQH/BAUwAwEB/zAtBgNVHREEJjAk\nggtleGFtcGxlLmNvbYIPd3d3LmV4YW1wbGUuY29thwRduNgiMA0GCSqGSIb3DQEB\nCwUAA4IBAQAuKFwfnnWy/XFIzv8cuhp28dUAdru4U96HtNW/6cIoZql48uEKlj/g\nRbNcSA7FRswa8sRxHSlefDa0VwW7NIWR/WJcEFQ+RGWQN52tqmGCtWLyvxPl4D3g\nBIRNhky1v00uLfQzmk0lU/xJR0WEjJjiMqdHKU/Evb3DE8f2Fq5zvc589wof385G\nq0XM7lhXuIDDPW93Jj59hlieAFjWsUSNwtFA3JEt+/XVz1/uX1alf3HHcmdlmd+Z\nRUgqt8rNzJb9c6bzMXO2TcCyMmiDKgcAvfqHwkLH5PWBuF4i0XVJHjBfEVNJzurT\nFNFTPK9ZdX9FLi9mzYSUJNZYa4ex5vjd\n-----END CERTIFICATE-----',
    },
  ],
  related: ['ssh-key-fingerprint', 'hash', 'text-encrypt'],
  status: 'stable',
};
