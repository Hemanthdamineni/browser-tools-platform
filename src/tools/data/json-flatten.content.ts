/**
 * Editorial content for the json-flatten tool page.
 *
 * Kept out of ``json-flatten.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Flatten turns objects into dotted paths',
      body: 'In flatten direction a nested object is walked depth-first and every leaf becomes a single key built from its ancestor names joined with dots. Objects become simple keys, arrays become indexed paths such as users.0.name, and empty containers are kept as empty objects or arrays rather than dropped. The result is emitted as a pretty-printed JSON object.',
    },
    {
      heading: 'Unflatten rebuilds the nesting',
      body: 'Switch to rebuild and paste a flat record of dotted keys. The parser reads both users.0.name and users[0].name forms, distinguishes array indexes from object keys, and reconstructs the nested structure. Contiguous numeric keys collapse back into arrays, so a record flattened with index style round-trips to the original array. Numbers, booleans and null keep their JSON types through the trip.',
    },
    {
      heading: 'Choosing the array path style',
      body: 'The Array paths option picks between users.0.name and users[0].name for flatten output. Both styles are accepted in rebuild mode regardless of the setting, and bracket indexes can be mixed freely with dotted names in a single key, which is handy when some of your object keys contain dots of their own.',
    },
    {
      heading: 'Conflict and depth limits',
      body: 'If a flattened record tries to put a value and a container at the same path — for example both a.b and a.b.c — unflatten refuses with a clear error instead of silently overwriting one. Deeply nested input is capped at 128 levels, and sorting the flattened keys is available when you want a canonical ordering.',
    },
    {
      heading: 'All the work happens on device',
      body: 'Parsing, flattening and rebuilding are plain JSON manipulation in this tab; there is no network call, so the tool works offline and your data never leaves the browser. A 1,000,000-character input ceiling keeps the page responsive on large documents.',
    },
  ],
  faq: [
    {
      q: 'How are arrays flattened?',
      a: 'Arrays become indexed paths: users.0.name. Switch the "Array paths" option to users[0].name if you prefer bracketed notation.',
    },
    {
      q: 'Can I get back to a nested object?',
      a: 'Yes — switch the direction to "Rebuild dotted". Paste a flat record and it is nested again, and types keep through the round trip.',
    },
    {
      q: 'What if dotted output and nested output conflict?',
      a: 'If a key is both a value and a container (a.b alongside a.b.c) unflatten refuses with a conflict error instead of guessing.',
    },
    {
      q: 'Does it preserve numbers, booleans and null?',
      a: 'Yes. Leaves are kept with their JSON types, and unflatten parses them back the same way they were given.',
    },
  ],
} as const;
