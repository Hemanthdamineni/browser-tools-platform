/**
 * Editorial content for the json-to-yaml tool page.
 *
 * Kept out of ``json-to-yaml.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it produces',
      body: 'Paste a JSON document and the tool parses it, then re-serialises it as YAML with the indent width you choose — 2 spaces by default, or 4 for teams whose linters insist on wider nesting. The result is a standard YAML block that keeps the original structure: objects become mappings, arrays become sequences, and quoted strings are emitted where YAML would otherwise misread them.',
    },
    {
      heading: 'A typical use',
      body: 'This is the quick path when you have a JSON payload — a Kubernetes manifest stub, a CI job, an app config copied out of a request — and the file you need to edit by hand is YAML. Converting once gives you properly indented YAML to paste into a repository, instead of re-indenting by eye and introducing a tab-versus-space bug.',
    },
    {
      heading: 'What the indent option changes',
      body: 'The indent option only affects whitespace: it sets how many spaces each nesting level is stepped in. It never changes keys, values or ordering, so the two settings always describe the same document and you can match whatever the surrounding file already uses.',
    },
    {
      heading: 'Strict JSON only, and privacy',
      body: 'The input must be valid JSON — comments, trailing commas and unquoted keys are rejected with a friendly error rather than guessed at, so a YAML-to-JSON round trip is a separate step. Everything happens in your browser using a bundled YAML library, with no upload and no network request, so it works fully offline.',
    },
  ],
  faq: [
    {
      q: 'What happens with invalid JSON?',
      a: 'The tool throws a friendly error with the parser message so you can find the syntax problem.',
    },
    {
      q: 'Are comments supported?',
      a: 'No. JSON has no comments, so the input must be strict JSON. Use YAML to JSON for the reverse direction.',
    },
    {
      q: 'Does the indent setting change the data?',
      a: 'No. Indent only controls blank space; keys, values, ordering and types are identical whether you pick 2 or 4 spaces.',
    },
  ],
} as const;
