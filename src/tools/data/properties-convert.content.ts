/**
 * Editorial content for the properties-convert tool page.
 *
 * Kept out of ``properties-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Properties in, JSON out',
      body: 'In the default direction the tool reads a Java properties file and returns one flat JSON object. Each value comes back as a string, because properties files carry no types. Comments starting with # or ! and blank lines are dropped, and a key ends at the first unescaped =, : or whitespace.',
    },
    {
      heading: 'JSON out to dotted keys',
      body: 'Switch the direction box to JSON to Properties and a JSON object is flattened into dotted keys: app.port, items.0, items.1 and so on, with arrays becoming numbered keys and empty objects written as blank values. Key order is preserved as authored.',
    },
    {
      heading: 'Continuing a Spring config file',
      body: 'A frequent job is turning application.properties into JSON so it can be diffed, checked or fed to a script. Backslash line continuations are joined before parsing, and escapes such as \\n, \\t, \\\\ and \\uXXXX are decoded back into real characters.',
    },
    {
      heading: 'Duplicate keys and escaping outbound',
      body: 'The parser follows Java semantics: when a key appears more than once the last value wins. Serializing escapes backslashes, newlines, tabs and any non-ASCII character, writing the latter as \\uXXXX so the output stays readable in any editor.',
    },
    {
      heading: 'Config never leaves the page',
      body: 'Reading and writing properties happen locally in the tab. Nothing is posted to a server and the tool runs offline, which matters when a config file holds credentials or internal host names.',
    },
  ],
  faq: [
    {
      q: 'Which comment and separator styles are supported?',
      a: 'Lines beginning with # or ! are skipped as comments, and blank lines are ignored. Keys end at the first unescaped =, : , or whitespace, matching Java properties rules.',
    },
    {
      q: 'Are multiline values supported?',
      a: 'Yes. A trailing backslash continues the value onto the next line, and escaped sequences like \\n, \\t, \\\\ and \\uXXXX are decoded into their real characters during parsing.',
    },
    {
      q: 'How does JSON to properties handle nested objects?',
      a: 'Objects are flattened with dotted keys (app.port → app.port), arrays become repeated numbered keys (items.0 = ...), and primitives are written as strings with escaping. Key order is preserved.',
    },
    {
      q: 'How are duplicate keys handled?',
      a: 'Pursuant to Java properties semantics, the last occurrence of a key wins during parsing. When generating, keys are written once.',
    },
  ],
} as const;
