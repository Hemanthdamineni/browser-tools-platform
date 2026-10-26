import { describe, expect, it } from 'vitest';
import tool from './ssh-key-fingerprint.tool';

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

const ED25519_PUB =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOCcqeCOuC04iszcemK+bZnxDaOqeRHcw5ctlGPywoQ7 edtest@example.com';
const ED_BLOB = 'AAAAC3NzaC1lZDI1NTE5AAAAIOCcqeCOuC04iszcemK+bZnxDaOqeRHcw5ctlGPywoQ7';
const RSA_PUB =
  'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDUV7IRkFFwybXuzUnj/Z9N7ydwVmuHLb4zIaPO6uSzvxEGFpMGOhlwAYmN8i+dEpGyag69SFvtYp4DPnxvbQwx1kfmK0A2rdZPxiMuHFJQrriR0XDmOIh7k5jVy53cd2F6QJsyqHMKCPeyiAdAh9ro28E+nidX5vIoiXvpZuMK/LwyblD47cE+9BGosVV+Sf424DnPhztgZdvMI7J7vWQcCh0zS40VOnBdEIhabBwM8hguLCm3K7HYqjlx48PwDZZ3XK32sJHfFIRa2Q5NebRbutYdQyfAg9pcfrXLCbjMo+1qHFhmnj5tjXW1isFJyd4xu6Q22IOfOU8sQUfuUQG/ rsatest@example.com';

describe('ssh-key-fingerprint', () => {
  it('reports instructions for blank input', async () => {
    const result = await run('   ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/paste an ssh public key/i);
  });

  it('fingerprints an Ed25519 key exactly as ssh-keygen does', async () => {
    expect(await get(ED25519_PUB, 'Key type')).toBe('ssh-ed25519');
    expect(await get(ED25519_PUB, 'Key size')).toBe('256 bits');
    expect(await get(ED25519_PUB, 'Comment')).toBe('edtest@example.com');
    expect(await get(ED25519_PUB, 'SHA256 fingerprint')).toBe(
      'SHA256:W5AvEHjdwfU10ltHwKZi/BPwSZQzsJrPqcb22XLWk+Y',
    );
    expect(await get(ED25519_PUB, 'MD5 fingerprint')).toBe(
      'MD5:43:64:5e:4d:f3:c4:d5:6e:c8:df:79:44:69:4c:5a:09',
    );
  });

  it('fingerprints an RSA key with the correct bit size', async () => {
    expect(await get(RSA_PUB, 'Key type')).toBe('ssh-rsa');
    expect(await get(RSA_PUB, 'Key size')).toBe('2048 bits');
    expect(await get(RSA_PUB, 'SHA256 fingerprint')).toBe(
      'SHA256:/ffKZ6vHQ2H/ZJt/9ix2sUUC9m3QwSIduLg9DZXUXs4',
    );
    expect(await get(RSA_PUB, 'MD5 fingerprint')).toBe(
      'MD5:c5:a6:66:f1:6f:4b:5c:c3:55:55:50:71:62:09:ec:95',
    );
  });

  it('accepts a bare base64 blob and detects the type from the blob', async () => {
    expect(await get(ED_BLOB, 'Key type')).toBe('ssh-ed25519');
    expect(await get(ED_BLOB, 'SHA256 fingerprint')).toBe(
      'SHA256:W5AvEHjdwfU10ltHwKZi/BPwSZQzsJrPqcb22XLWk+Y',
    );
  });

  it('tolerates leading/trailing whitespace', async () => {
    const messy = `\n  ${ED25519_PUB}\n\t`;
    expect(await get(messy, 'SHA256 fingerprint')).toBe(
      'SHA256:W5AvEHjdwfU10ltHwKZi/BPwSZQzsJrPqcb22XLWk+Y',
    );
  });

  it('rejects bad base64 with a clear error', async () => {
    await expect(run('ssh-ed25519 not-b64!!')).rejects.toThrow(/base64/i);
  });

  it('rejects garbage input', async () => {
    await expect(run('this is not a key @@@')).rejects.toThrow();
  });

  it('exposes stats for key bits', async () => {
    const result = await run(RSA_PUB);
    expect(result.stats?.bits).toBe(2048);
  });

  it('runs the "RSA key" example without throwing', async () => {
    const example =
      'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAAgQDimgA3WT34Riu5WUXpQGK5r5rULP5BHGHoInHLR/5PXHKfm5YOV05FPrYPjbP/VSGlHku3OjuYJegw85k/VGzXQ9BbjEHmxqm5QV5/MBA9TJ9oEILw2Oe6aXFSU2VWP1HH7dXoKsgLnEpoxQGrV3Vzjk0uekUlwNyI5YlcGAvRxw== deploy@build01';
    expect(await get(example, 'Key type')).toBe('ssh-rsa');
    expect(await get(example, 'Key size')).toBe('1024 bits');
    expect(await get(example, 'SHA256 fingerprint')).toMatch(/^SHA256:[A-Za-z0-9+/]+={0,2}$/);
    expect(await get(example, 'Comment')).toBe('deploy@build01');
  });
});
