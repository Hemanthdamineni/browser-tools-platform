/**
 * Editorial content for the json-escape tool page.
 *
 * Kept out of ``json-escape.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Do I need to include the surrounding quotes when unescaping?',
      a: 'No. If the input is not already wrapped in double quotes, a pair is added before parsing.',
    },
    {
      q: 'What happens on invalid input when unescaping?',
      a: 'If the text is not a valid JSON string literal (for example an unterminated string or a non-string value) the tool reports an error.',
    },
  ],
} as const;
