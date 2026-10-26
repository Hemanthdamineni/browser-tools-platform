/**
 * Editorial content for the jsdoc-generator tool page.
 *
 * Kept out of ``jsdoc-generator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the generator emits',
      body: 'Paste a signature and the tool returns a JSDoc block opened and closed with the standard slash-star-star comments: an optional sentence telling you what to write, one @param line per parameter in the order they appear, and a @returns line at the end. Each tag ends with a hyphen and a space, so your cursor has an obvious place to land after pasting the comment above the function. The stats report how many parameters were found, and the block is returned as JavaScript you can copy straight into the file.',
    },
    {
      heading: 'The signature shapes it recognises',
      body: 'Function declarations with the function keyword, shorthand forms written as name(a, b), async variants of both, and arrow functions assigned with const, let or var are all parsed, including arrow functions that take a single unparenthesised parameter. Default values, rest parameters and destructured object or array parameters are carried through because the parameter list is split on commas that sit outside any bracket, brace or parenthesis. Line comments and stray newlines inside the signature are stripped first, and anything the parser cannot read as a signature is rejected with an example rather than guessed at.',
    },
    {
      heading: 'How parameter names are derived',
      body: 'A parameter keeps its own identifier wherever there is one. A leading rest operator is removed, so ...opts becomes opts, and a TypeScript-style this parameter is dropped. Destructuring has no single name to use, so the pattern is reduced to its first identifier — a props object becomes props — and in that case a note reminds you to expand it into @property lines yourself, since the comment template cannot know the shape of the object. No types are invented: you add the braces yourself.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Each run documents one signature, and input longer than ten thousand characters is refused as too large, so this is a scaffold rather than a documentation extractor. Tags such as @throws, @example, @deprecated and @see are not generated, and @returns is always included even for a void function, because removing it is one keystroke and forgetting it is a defect. Parsing is a plain text operation on your device — the signature you paste is not uploaded and no request leaves the tab.',
    },
  ],
  faq: [
    {
      q: 'Which signatures does it accept?',
      a: 'Function declarations (function name(a, b)), the shorthand name(a, b), async functions, arrows (const f = (x) => …), defaults, rest parameters and simple object/array destructuring.',
    },
    {
      q: 'How are parameters named?',
      a: 'Each parameter becomes @param with its original name and position. Destructured parameters get the whole pattern name (e.g. { name } for the props object), with a hint to expand it into @property lines if you need them.',
    },
    {
      q: 'Is @returns always included?',
      a: 'Yes, a @returns line is always emitted as a template. Async functions keep the same shape — you can annotate Promise<…> yourself.',
    },
  ],
} as const;
