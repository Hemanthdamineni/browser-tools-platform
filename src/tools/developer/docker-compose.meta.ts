import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'docker-compose',
  name: 'docker-compose.yml Generator',
  category: 'developer',
  summary:
    'Build a docker-compose.yml for one service — image, ports, environment, volumes and restart policy.',
  description:
    'Compose a Docker service declaration from simple options: service name, image, container name, published ports, environment variables, volumes and a restart policy. The tool emits a clean, valid docker-compose.yml you can paste into your project, with proper YAML quoting of port mappings and environment lines.',
  keywords: [
    'docker compose generator',
    'docker-compose.yml',
    'generate compose file',
    'docker services',
    'compose yaml',
    'docker stack config',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'serviceName',
      label: 'Service name',
      type: 'text',
      default: 'app',
      placeholder: 'app',
    },
    {
      key: 'image',
      label: 'Image',
      type: 'text',
      default: 'node:20-alpine',
      placeholder: 'node:20-alpine',
    },
    {
      key: 'containerName',
      label: 'Container name (optional)',
      type: 'text',
      default: '',
      placeholder: 'app-web',
    },
    {
      key: 'ports',
      label: 'Ports (host:container, comma-separated)',
      type: 'text',
      default: '8080:3000',
      placeholder: '8080:3000, 5432:5432',
    },
    {
      key: 'env',
      label: 'Environment (one KEY=value per line)',
      type: 'textarea',
      default: 'NODE_ENV=production',
      placeholder: 'NODE_ENV=production',
    },
    {
      key: 'volumes',
      label: 'Volumes (host:container, one per line)',
      type: 'textarea',
      default: '',
      placeholder: './data:/data',
    },
    {
      key: 'restart',
      label: 'Restart policy',
      type: 'select',
      choices: [
        { value: 'no', label: 'no' },
        { value: 'always', label: 'always' },
        { value: 'on-failure', label: 'on-failure' },
        { value: 'unless-stopped', label: 'unless-stopped' },
      ],
      default: 'unless-stopped',
    },
  ],
  examples: [
    {
      title: 'A web app',
      input: '',
      options: {
        serviceName: 'web',
        image: 'node:20-alpine',
        ports: '8080:3000',
        env: 'NODE_ENV=production\nPORT=3000',
        volumes: './data:/data',
      },
    },
    {
      title: 'A PostgreSQL database',
      input: '',
      options: {
        serviceName: 'db',
        image: 'postgres:16',
        containerName: 'app-db',
        ports: '5432:5432',
        env: 'POSTGRES_USER=app\nPOSTGRES_PASSWORD=secret\nPOSTGRES_DB=app',
        volumes: 'pgdata:/var/lib/postgresql/data',
        restart: 'always',
      },
    },
    {
      title: 'A headless worker with no ports',
      input: '',
      options: {
        serviceName: 'worker',
        image: 'node:20-alpine',
        env: 'QUEUE_URL=amqp://mq',
        restart: 'on-failure',
      },
    },
  ],
  related: ['json-to-yaml', 'json-to-env', 'dotenv', 'ini-convert'],
  status: 'stable',
};
