/**
 * Editorial content for the dockerfile-generator tool page.
 *
 * Kept out of ``dockerfile-generator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
