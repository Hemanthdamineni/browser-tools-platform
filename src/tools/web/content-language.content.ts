/**
 * Editorial content for the content-language tool page.
 *
 * Kept out of ``content-language.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What Content-Language describes',
      body: 'This response header states the natural language of the representation a client just received, using BCP 47-style tags such as en-US or fr-CA. Analyze mode reads a pasted value and classifies each tag, while build mode assembles a clean header value from a comma-separated list and refuses values that fail validation.',
    },
    {
      heading: 'Reading a language tag',
      body: 'A tag is checked in its standard order: a primary language subtag, an optional script such as Latn, an optional region such as US or a three-digit code, then variants, extensions and the x private-use tail. The checker accepts the common shapes and flags anything that does not fit, without claiming to know the full IANA registry.',
    },
    {
      heading: 'Wildcards, duplicates and private use',
      body: 'A lone * is allowed because it can mean all languages are intended, but mixing it with explicit tags is called out. Repeated tags are reported, and a private-use x- subtag is flagged as opaque, since such tags mean different things to different applications and may not interoperate.',
    },
    {
      heading: 'Metadata, not preference',
      body: 'Content-Language describes the resource; it is not the same as the Accept-Language a client sends. Every tag is parsed and validated inside this page with no network access, so no request detail leaves your device.',
    },
  ],
  faq: [
    {
      q: 'Is Content-Language the same as the user preferred language?',
      a: 'No. Content-Language describes the language or languages of the representation. Accept-Language expresses client preferences.',
    },
    {
      q: 'What does * mean?',
      a: 'The wildcard can indicate that all languages are intended or that no specific language was selected, depending on application context.',
    },
    {
      q: 'Does this fully implement BCP 47?',
      a: 'It validates common language, script, region, variant, extension, and private-use shapes. It does not maintain the complete IANA language-subtag registry.',
    },
  ],
} as const;
