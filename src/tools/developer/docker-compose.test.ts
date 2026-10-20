import { describe, expect, it } from 'vitest';
import tool from './docker-compose.tool';

type Result = {
  output: string;
  render?: string;
  language?: string;
  stats?: Record<string, number>;
  notes?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const out = async (options: Record<string, string | number | boolean> = {}) =>
  (await run('', options)).output;

describe('docker-compose', () => {
  it('emits a minimal service from defaults', async () => {
    const o = await out({});
    expect(o).toContain('version: "3.8"');
    expect(o).toContain('services:');
    expect(o).toContain('  app:');
    expect(o).toContain('    image: "node:20-alpine"');
  });

  it('includes ports, environment and volumes when provided', async () => {
    const o = await out({
      serviceName: 'web',
      image: 'nginx:stable',
      ports: '8080:80, 443:443',
      env: 'NODE_ENV=production',
      volumes: './data:/data',
      containerName: 'web-c',
    });
    expect(o).toContain('    ports:');
    expect(o).toContain('      - "8080:80"');
    expect(o).toContain('      - "443:443"');
    expect(o).toContain('    environment:');
    expect(o).toContain('      - "NODE_ENV=production"');
    expect(o).toContain('    volumes:');
    expect(o).toContain('      - "./data:/data"');
    expect(o).toContain('    container_name: "web-c"');
    expect(o).toContain('    restart: "unless-stopped"');
  });

  it('omits restart when set to no', async () => {
    const o = await out({ restart: 'no' });
    expect(o).not.toContain('restart:');
  });

  it('omits optional sections when empty', async () => {
    const o = await out({ ports: '', env: '', volumes: '' });
    expect(o).not.toContain('ports:');
    expect(o).not.toContain('environment:');
    expect(o).not.toContain('volumes:');
  });

  it('rejects an empty image and invalid service names', async () => {
    await expect(run('', { image: '  ' })).rejects.toThrow(/image name/i);
    await expect(run('', { image: 'nginx', serviceName: 'Bad Name!' })).rejects.toThrow(
      /service name/i,
    );
  });
});
