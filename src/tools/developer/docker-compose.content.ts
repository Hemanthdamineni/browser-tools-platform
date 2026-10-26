/**
 * Editorial content for the docker-compose tool page.
 *
 * Kept out of ``docker-compose.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
