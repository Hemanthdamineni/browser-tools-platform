import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './dockerfile-generator.meta';

function lines(value: unknown): string[] {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

function csv(value: unknown): string[] {
  const out: string[] = [];
  for (const part of String(value ?? '').split(',')) {
    const p = part.trim();
    if (p !== '') out.push(p);
  }
  return out;
}

/** Emit an instruction in Dockerfile JSON-array form. */
function jsonArgs(s: string): string {
  const parts = s.split(/\s+/).filter(Boolean);
  return '["' + parts.map((p) => p.replace(/"/g, '\\"')).join('", "') + '"]';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const base = String(o.base ?? '').trim();
  const workdir = String(o.workdir ?? '').trim();
  const env = lines(o.env ?? '');
  const copy = lines(o.copy ?? '');
  const runSteps = lines(o.run ?? '');
  const cmd = String(o.cmd ?? '').trim();
  const entrypoint = String(o.entrypoint ?? '').trim();

  if (!base)
    throw new ToolError('Provide a base image.', 'e.g. node:20-alpine or python:3.12-slim');
  if (!workdir || !workdir.startsWith('/')) {
    throw new ToolError('WORKDIR must be an absolute path.', 'e.g. /app or /srv');
  }
  for (const c of copy) {
    if (c.split(/\s+/).length !== 2) {
      throw new ToolError(
        'Each COPY line needs a source and a destination.',
        c + ' -> e.g. "package*.json ./"',
      );
    }
  }
  if (!cmd)
    throw new ToolError(
      'Provide a default command (CMD).',
      'e.g. npm start or ["uvicorn", "main:app"]',
    );
  const ports = csv(o.ports ?? '');
  for (const p of ports) {
    if (!/^[0-9]+$/.test(p)) {
      throw new ToolError('EXPOSE ports must be numbers.', 'Got "' + p + '".');
    }
  }

  const out: string[] = [];
  out.push('FROM ' + base);
  out.push('WORKDIR ' + workdir);
  out.push('# ---- environment ----');
  for (const e of env) out.push('ENV ' + e);
  out.push('# ---- copy source ----');
  for (const c of copy) out.push('COPY ' + c);
  out.push('# ---- build/install ----');
  for (const r of runSteps) out.push('RUN ' + r);
  if (entrypoint) out.push('ENTRYPOINT ' + jsonArgs(entrypoint));
  for (const p of ports) out.push('EXPOSE ' + p);
  out.push('CMD ' + jsonArgs(cmd));

  return {
    output: out.join('\n') + '\n',
    render: 'text',
    language: 'text',
    stats: { env: env.length, copy: copy.length, run: runSteps.length, ports: ports.length },
    notes: [
      'CMD emitted in JSON array form so quoting stays safe.',
      entrypoint
        ? 'ENTRYPOINT set; CMD becomes its default arguments.'
        : 'No ENTRYPOINT — the image runs CMD directly.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
