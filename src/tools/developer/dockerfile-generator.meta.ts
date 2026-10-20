import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'dockerfile-generator',
  name: 'Dockerfile Generator',
  category: 'developer',
  summary:
    'Build a Dockerfile from friendly fields — base image, workdir, env, ports, RUN steps and CMD — ready to paste.',
  description:
    'Compose a Dockerfile without hand-writing Docker syntax: choose a base image, set the working directory, add environment variables, pick EXPOSE ports, type RUN commands and a default CMD. The tool emits a clean, conventional Dockerfile with predictable layer ordering, quoted ENV/CMD forms that handle special characters safely, and validates numeric ports.',
  keywords: [
    'dockerfile generator',
    'generate dockerfile',
    'docker build file',
    'containerfile builder',
    'docker image build',
    'dockerfile from fields',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'base',
      label: 'Base image',
      type: 'text',
      default: 'node:20-alpine',
      placeholder: 'node:20-alpine',
    },
    {
      key: 'workdir',
      label: 'Working directory',
      type: 'text',
      default: '/app',
      placeholder: '/app',
    },
    {
      key: 'env',
      label: 'Environment (one KEY=VALUE per line)',
      type: 'textarea',
      default: 'NODE_ENV=production',
      placeholder: 'NODE_ENV=production',
    },
    {
      key: 'ports',
      label: 'Expose ports (comma-separated)',
      type: 'text',
      default: '3000',
      placeholder: '3000, 8080',
    },
    {
      key: 'copy',
      label: 'COPY lines ("source dest", one per line)',
      type: 'textarea',
      default: 'package*.json ./',
      placeholder: 'package*.json ./\nsrc ./src',
    },
    {
      key: 'run',
      label: 'RUN commands (one per line)',
      type: 'textarea',
      default: 'npm ci --omit=dev',
      placeholder: 'npm ci --omit=dev',
    },
    {
      key: 'cmd',
      label: 'Default command (CMD)',
      type: 'text',
      default: 'npm start',
      placeholder: 'npm start',
    },
    {
      key: 'entrypoint',
      label: 'Entrypoint (optional)',
      type: 'text',
      default: '',
      placeholder: '',
    },
  ],
  examples: [
    {
      title: 'A Node app',
      input: '',
      options: {
        base: 'node:20-alpine',
        workdir: '/app',
        env: 'NODE_ENV=production',
        ports: '3000',
        run: 'npm ci --omit=dev',
        cmd: 'npm start',
      },
    },
  ],
  faq: [
    {
      q: 'What does the generated file look like?',
      a: 'A conventional Dockerfile: FROM, WORKDIR, ENV (one line per variable), COPY lines, then RUN steps, EXPOSE and finally ENTRYPOINT (if set) and CMD. Order follows the common optimised-for-caching layout.',
    },
    {
      q: 'Are special characters handled?',
      a: 'ENTRYPOINT and CMD are emitted in their JSON array form so values with spaces and quotes stay intact, instead of the fragile shell form.',
    },
    {
      q: 'Do I need a base image with a tag?',
      a: 'A tag is recommended but not required — whatever you type in “Base image” is emitted verbatim, so private registries and digests work too.',
    },
  ],
  related: ['docker-compose', 'json-to-env', 'dotenv', 'glob-tester'],
  status: 'stable',
};
