/**
 * Editorial content for the yaml-to-json tool page.
 *
 * Kept out of ``yaml-to-json.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'YAML in, JSON out',
      body: 'Paste a YAML document and the tool parses it with the yaml package under the YAML 1.2 core schema, then re-serialises the resulting value as JSON. The output keeps the document structure — mappings become objects, sequences become arrays, and scalars keep their type — so a nested config becomes a nested JSON object. The result is presented as JSON you can copy or download as data.json.',
    },
    {
      heading: 'When to convert',
      body: 'Docker Compose files, Kubernetes manifests, GitHub Actions workflows and Ansible inventories are all YAML, while many APIs, log pipelines and JavaScript tools expect JSON. This conversion lets you move a config between the two without hand-editing braces, and it is a quick way to check exactly what a YAML file actually resolves to before you rely on it.',
    },
    {
      heading: 'Indent and key sorting',
      body: 'The indent option sets how the JSON is nested — 2 spaces, 4 spaces or a tab — and only affects readability, never the data. The sort keys switch reorders every object alphabetically at every depth, which is handy for diffing two configs that were written in different orders. Array order is always preserved, because changing it would change meaning.',
    },
    {
      heading: 'What YAML allows that trips people up',
      body: 'The core schema gives you anchors and aliases, so a document that reuses a block via &anchor and *alias is expanded into repeated JSON values. An empty document produces empty output rather than an error, and a document that is not valid YAML is refused with the parser message so you can find the offending line. Duplicate keys, tabs used for indentation and ambiguous scalars are all things the parser may reject.',
    },
    {
      heading: 'Local by design',
      body: 'Parsing and serialisation both happen in your browser. Your configuration is never uploaded, which makes the tool safe for YAML containing credentials, internal hostnames or keys you would not paste into a hosted converter.',
    },
  ],
  faq: [
    {
      q: 'Which YAML version is supported?',
      a: 'YAML 1.2 core schema, including anchors and aliases, via the yaml package. Invalid documents raise a friendly error.',
    },
    {
      q: 'Does sorting recurse into nested objects?',
      a: 'Yes. Every object in the tree has its keys sorted; array order is always preserved.',
    },
    {
      q: 'Are anchors and aliases expanded?',
      a: 'Yes. An aliased value becomes a full copy in the JSON output, because JSON has no way to express YAML anchors — the data is identical, only the sharing is lost.',
    },
  ],
} as const;
