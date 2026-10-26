/**
 * Editorial content for the authentication-info tool page.
 *
 * Kept out of ``authentication-info.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Building one parameter',
      body: 'Build mode turns a chosen parameter and value into the field a Digest response would carry. nextnonce and rspauth are wrapped in double quotes with embedded quotes and backslashes escaped, while nc is written bare and checked against exactly eight hexadecimal digits.',
    },
    {
      heading: 'Reading a pasted parameter list',
      body: 'Analyze mode splits a comma-separated Authentication-Info value, keeping quoted strings intact, and lists each parameter with its decoded value and a status. It flags invalid tokens, duplicates, unknown names, an empty nextnonce or rspauth, and an nc that is not eight hex digits.',
    },
    {
      heading: 'A typical use',
      body: 'Reach for it when a Digest response looks wrong and you want to confirm the nextnonce or nc before wiring the header into a client, instead of splitting the value by hand.',
    },
    {
      heading: 'What it does not prove',
      body: 'Only syntax is checked. rspauth is a response digest and cannot be verified without the matching request context and shared secret, so a clean status is not proof that the response is authentic.',
    },
    {
      heading: 'Handled locally',
      body: 'Parsing and building happen inside the page. No credential or nonce is uploaded, and the tool makes no network request.',
    },
  ],
  faq: [
    {
      q: 'Does Authentication-Info contain credentials?',
      a: 'It carries response-side Digest authentication parameters, not the user password. Still avoid pasting live production nonces or tokens into shared environments.',
    },
    {
      q: 'What is nextnonce?',
      a: 'It lets a server provide a nonce for a subsequent authenticated request, reducing the need for another challenge.',
    },
    {
      q: 'Does this verify rspauth?',
      a: 'No. It validates field syntax only and cannot verify a response digest without the request context and secret.',
    },
  ],
} as const;
