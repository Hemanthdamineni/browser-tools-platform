import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './docker-compose.meta';

const VERSION = '3.8';

function cleanInput(value: unknown): string {
  const s = String(value ?? '');
  return s.trim();
}

function listLines(value: unknown): string[] {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

function listComma(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

function q(s: string): string {
  // Quote as a YAML string
  const escaped = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return '"' + escaped + '"';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const service = cleanInput(o.serviceName ?? 'app');
  const image = cleanInput(o.image ?? '');
  const containerName = cleanInput(o.containerName ?? '');
  const ports = listComma(o.ports ?? '');
  const env = listLines(o.env ?? '');
  const volumes = listLines(o.volumes ?? '');
  const restart = cleanInput(o.restart ?? 'unless-stopped');

  if (!image) throw new ToolError('Need an image name.', 'e.g. node:20-alpine or nginx:stable');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(service)) {
    throw new ToolError('Service name must be lowercase alphanumeric with dashes.', 'e.g. web, api, db');
  }

  const lines: string[] = [];
  lines.push('version: "' + VERSION + '"');
  lines.push('services:');
  lines.push('  ' + service + ':');
  lines.push('    image: ' + q(image));
  if (containerName) lines.push('    container_name: ' + q(containerName));
  if (ports.length) {
    lines.push('    ports:');
    for (const p of ports) lines.push('      - ' + q(p));
  }
  if (env.length) {
    lines.push('    environment:');
    for (const e of env) lines.push('      - ' + q(e));
  }
  if (volumes.length) {
    lines.push('    volumes:');
    for (const v of volumes) lines.push('      - ' + q(v));
  }
  if (restart && restart !== 'no') lines.push('    restart: ' + q(restart));

  return {
    output: lines.join('\n') + '\n',
    render: 'text',
    language: 'yaml',
    stats: { services: 1, ports: ports.length, volumes: volumes.length },
    notes: [
      'docker-compose v' + VERSION + ' with service "' + service + '".',
      restart === 'no' || restart === ''
        ? 'No restart policy set (defaults to no).'
        : 'Restart policy: ' + restart + '.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
