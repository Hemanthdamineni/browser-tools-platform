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
  article: [
    {
      heading: 'A single-service compose file',
      body: 'Pick a service name and describe one container: its image, an optional container name, comma-separated published host:container ports, per-line environment KEY=value pairs, per-line bind-mount volumes in host:container form, and one of four restart policies. The output is a version-pinned docker-compose.yml with a services block holding a single service beneath it.',
    },
    {
      heading: 'When a hand-written service block saves time',
      body: 'Reach for it when spinning up a quick local dependency — a database, a queue, a sidecar — and you want the YAML right the first time. Paste the result into your compose file or docker-compose up -f it directly; the generated restart line, port list and volume mounts are already in valid v3 form.',
    },
    {
      heading: 'Ports, environment and volumes input rules',
      body: 'Ports are comma-separated host:container pairs, environment and volumes are one entry per line, and each is emitted as a quoted YAML string so colons and spaces never break the parse. An empty container name, empty ports, or empty volumes simply omits that key from the output.',
    },
    {
      heading: 'Validation and YAML quoting',
      body: 'The service name must be lowercase alphanumeric with dashes, and an image is required or the tool stops with an error. Values are wrapped in double quotes with backslashes and quotes escaped, so a password with a colon or a mount path with a space survives round-tripping.',
    },
    {
      heading: 'Nothing is sent off this device',
      body: 'The file is assembled entirely in this tab and returned as text you copy; your image names, ports and secrets never leave the browser.',
    },
  ],
  faq: [
    {
      q: 'Which fields can I set?',
      a: 'Service name, image, container name, published ports (host:container), environment variables, bind-mount volumes and a restart policy. Unused optional fields are omitted so the YAML stays clean.',
    },
    {
      q: 'Is the YAML valid?',
      a: 'Very likely — ports and environment lines are emitted as YAML strings, which avoids the classic colon-parsing traps. If you edit it by hand, keep that quoting.',
    },
    {
      q: 'Can I add more services?',
      a: 'This builds a single-service file. Reproduce it per service and merge the services: block, or push each generated file through a YAML formatter afterwards.',
    },
  ],
  related: ['json-to-yaml', 'json-to-env', 'dotenv', 'ini-convert'],
  status: 'stable',
};
