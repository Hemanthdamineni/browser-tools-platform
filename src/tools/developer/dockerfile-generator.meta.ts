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
    {
      title: 'A Python web service',
      options: {
        base: 'python:3.12-slim',
        workdir: '/srv',
        env: 'PYTHONUNBUFFERED=1',
        copy: 'requirements.txt ./',
        run: 'pip install --no-cache-dir -r requirements.txt',
        ports: '8000',
        cmd: 'uvicorn main:app --host 0.0.0.0',
      },
    },
    {
      title: 'Static files served by nginx',
      options: {
        base: 'nginx:1.27-alpine',
        workdir: '/usr/share/nginx/html',
        env: '',
        copy: 'dist ./',
        run: '',
        ports: '80',
        entrypoint: '/docker-entrypoint.sh',
        cmd: 'nginx -g daemon off;',
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
  article: [
    {
      heading: 'What the Dockerfile Generator emits',
      body: 'Fill in fields and the generator returns a complete Dockerfile in caching-friendly order: FROM, WORKDIR, one ENV line per variable, your COPY lines, RUN steps, any ENTRYPOINT, EXPOSE ports and a CMD, with comment separators between the stages. The base image is emitted verbatim, so tags, digests and private registries all work.',
    },
    {
      heading: 'When to sketch a Dockerfile here',
      body: 'Use it when you are starting an image and would rather fill a form than recall Docker syntax, or when you want a conventional layer order to compare your own file against. It also handles the JSON-array quoting rules for ENTRYPOINT and CMD for you.',
    },
    {
      heading: 'The fields that matter',
      body: 'Base image defaults to node:20-alpine, WORKDIR must be absolute, and Environment, COPY and RUN are typed one entry per line. Ports are comma-separated. ENTRYPOINT is optional; when it is set, the note reminds you that CMD becomes its default arguments.',
    },
    {
      heading: 'Rules the generator enforces',
      body: 'A missing base image, a relative WORKDIR, a COPY line without exactly two tokens, a missing CMD and a non-numeric EXPOSE port each raise an error showing the right form. ENTRYPOINT and CMD are always written as JSON arrays so values with spaces and quotes survive.',
    },
    {
      heading: 'Nothing leaves the browser',
      body: 'The file is assembled on your device from what you type; no image is built and nothing is sent anywhere.',
    },
  ],
  related: ['docker-compose', 'json-to-env', 'dotenv', 'glob-tester'],
  status: 'stable',
};
