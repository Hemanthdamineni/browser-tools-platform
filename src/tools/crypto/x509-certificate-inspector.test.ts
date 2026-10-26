import { describe, expect, it } from 'vitest';
import tool from './x509-certificate-inspector.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
type Table = { headers: string[]; rows: [string, string][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result) => JSON.parse(r.output) as Table;
const get = async (
  text: string,
  key: string,
  options: Record<string, string | number | boolean> = {},
) => table(await run(text, options)).rows.find((row) => row[0] === key)?.[1];

const CERT_PEM = `-----BEGIN CERTIFICATE-----
MIID/DCCAuSgAwIBAgIUTnVaXxVzi9vZDzYpqiLQgcpK/vEwDQYJKoZIhvcNAQEL
BQAweTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcM
DVNhbiBGcmFuY2lzY28xFDASBgNVBAoMC0V4YW1wbGUgT3JnMREwDwYDVQQLDAhQ
bGF0Zm9ybTEUMBIGA1UEAwwLZXhhbXBsZS5jb20wHhcNMjYxMDE4MDgxMzUyWhcN
MjcxMDE4MDgxMzUyWjB5MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5p
YTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEUMBIGA1UECgwLRXhhbXBsZSBPcmcx
ETAPBgNVBAsMCFBsYXRmb3JtMRQwEgYDVQQDDAtleGFtcGxlLmNvbTCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAOc4XpEcAsMqe+yeCln2U0r0AZ17Lj5t
/eACNjqD6p1zHEk0Zgmdet+abADx1D8nMeH/3jeRsU/0MDe7zrTVeCZOY0K2zNnX
5F3/2Tc4WtLH8+sz3LABVHKwlnstNU44Yp8jnw+kALnD3o67F1z6nb764lQGyv8s
h1HXSh16D8jwMEL1VhFHV/9iAc9rq0qa3+0B+ieJIU6T5O82MdGYjgbDLyE4WnnP
eUPLbqP9NxRPBDnCLTTSdtdJdkmvjn6hTpkkfyA4l7uepUC09QiRBlQ4z7B9hfJL
Id6YAkvCwXuJeTgE/6qMM8K5W2f8rFVoZcsU0iAeX/53izNnSDKppfsCAwEAAaN8
MHowHQYDVR0OBBYEFLaU0Lx+A7sFkmzi7ypBXMyXHm/bMB8GA1UdIwQYMBaAFLaU
0Lx+A7sFkmzi7ypBXMyXHm/bMCcGA1UdEQQgMB6CC2V4YW1wbGUuY29tgg93d3cu
ZXhhbXBsZS5jb20wDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEA
bsL+PeA1P/da4K8xHVmy/uu6ndOLBNss2IWwqmRPI2pSJ/TpjEndYjLpPQ0/bmAn
1NAFz8UAAudxpptg2LXfJW12rkqKOPfyypQ4reGzKuesmgjCeFX0SjwZ7tlghfCW
LqPRALK60WjvEBm4PQbP1zq+qC2Drr305GAPpSlLAElzEtdQkk47/u/ru3zXrZUM
DIGRx+tQSnOJmgoqhNDfWI8TVezzeX6WUTxyLL8b+njVA2+fzEOmeQ2fdCzEldzS
TlZGzYW6baJzeYPHdD1KZmUb9sueymclrCvhpyPZIn734Ir6h+NESiZJ/5JPBwBC
xMezDok7CZzWZ+vtmbnLnQ==
-----END CERTIFICATE-----`;

const EXAMPLE_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIICyTCCAjKgAwIBAgIULJ1+KEaZwrqWmGpN673Cn4IK9hswDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0V4YW1wbGUxFDASBgNVBAcMC1Nw
cmluZ2ZpZWxkMRUwEwYDVQQKDAxFeGFtcGxlIENvcnAxFDASBgNVBAMMC2V4YW1w
bGUuY29tMB4XDTI2MTAyNjEyMjYxM1oXDTM2MTAyMzEyMjYxM1owYjELMAkGA1UE
BhMCVVMxEDAOBgNVBAgMB0V4YW1wbGUxFDASBgNVBAcMC1NwcmluZ2ZpZWxkMRUw
EwYDVQQKDAxFeGFtcGxlIENvcnAxFDASBgNVBAMMC2V4YW1wbGUuY29tMIGfMA0G
CSqGSIb3DQEBAQUAA4GNADCBiQKBgQDuNmxGE/JosLx69ZkKtGajN8enukMH3xk8
eIusOM6/jACxRFuJ7R5CJQsYI8C0yiOf39uWQlDL90ayRvHxr0WZTqU9JBe66TOD
TyhkMCZ7dWdZL10jPre1l/fHLA1GbueKFgAdhISOi1r/ZY0X6iP6gLjb2RuAwCU/
Hi80FNRDXQIDAQABo3wwejAdBgNVHQ4EFgQUFg9keJjQOyYvVXcqqURJGKWCCq4w
HwYDVR0jBBgwFoAUFg9keJjQOyYvVXcqqURJGKWCCq4wDwYDVR0TAQH/BAUwAwEB
/zAnBgNVHREEIDAeggtleGFtcGxlLmNvbYIPd3d3LmV4YW1wbGUuY29tMA0GCSqG
SIb3DQEBCwUAA4GBAM5G1jJ9HE4EeMogxXQUWHznlCWbidY1Ki82HQ2JOcXn5Zgx
4sCPOLdB/OvBBw2ct3vN4r+dhg84Ji/DUxxOWb+Orsbas+7IOII38ExZEgueyqIr
u+38l4R50sVqHEb1wFp8DxerG3yzTiB9hWXBGNODZjoq0O8/W4pKUWGSIA7p
-----END CERTIFICATE-----`;

describe('x509-certificate-inspector', () => {
  it('reports instructions for blank input', async () => {
    const result = await run('  ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/paste a pem certificate/i);
  });

  it('extracts subject, issuer, serial and signature', async () => {
    expect(await get(CERT_PEM, 'Subject')).toContain('commonName=example.com');
    expect(await get(CERT_PEM, 'Subject')).toContain('organizationName=Example Org');
    expect(await get(CERT_PEM, 'Issuer')).toContain('countryName=US');
    expect(await get(CERT_PEM, 'Serial number')).toBe(
      '4e:75:5a:5f:15:73:8b:db:d9:0f:36:29:aa:22:d0:81:ca:4a:fe:f1',
    );
    expect(await get(CERT_PEM, 'Signature algorithm')).toBe('sha256WithRSAEncryption');
  });

  it('reads validity and reports stats', async () => {
    const result = await run(CERT_PEM);
    const notBefore = await get(CERT_PEM, 'Not before');
    expect(notBefore).toMatch(/2026-10-18/);
    expect(await get(CERT_PEM, 'Not after')).toMatch(/2027-10-18/);
    expect(await get(CERT_PEM, 'Days remaining')).toBeTruthy();
    expect(result.stats?.bits).toBe(2048);
    expect(result.stats?.bytes).toBeGreaterThan(0);
  });

  it('extracts public key details', async () => {
    expect(await get(CERT_PEM, 'Public key type')).toBe('RSA');
    expect(await get(CERT_PEM, 'Key size')).toBe('2048 bits');
    expect(await get(CERT_PEM, 'RSA exponent')).toBe('0x010001');
  });

  it('reads SAN, basic constraints and fingerprints', async () => {
    const result = await run(CERT_PEM);
    const joined = result.notes?.join(' ') ?? '';
    expect(joined).toContain('Subject Alternative Name');
    expect(joined).toContain('DNS: example.com, www.example.com');
    expect(joined).toContain('Basic Constraints: CA:TRUE');
    expect(joined).toMatch(/SHA-256 fingerprint: [0-9a-f:]{59}/);
    expect(joined).toMatch(/SHA-1 fingerprint: [0-9a-f:]{59}/);
  });

  it('tolerates a cert without PEM armor', async () => {
    const raw = CERT_PEM.replace(/-----BEGIN CERTIFICATE-----\n/, '')
      .replace(/\n-----END CERTIFICATE-----/, '')
      .replace(/\n/g, '');
    expect(await get(raw, 'Public key type')).toBe('RSA');
  });

  it('rejects non-certificate input', async () => {
    await expect(run('this is not a certificate')).rejects.toThrow(/certificate/i);
  });

  it('runs the "Certificate details" example without throwing', async () => {
    const result = await run(EXAMPLE_CERT_PEM);
    expect(table(result).rows.length).toBeGreaterThan(0);
    expect(await get(EXAMPLE_CERT_PEM, 'Subject')).toContain('commonName=example.com');
  });
});
