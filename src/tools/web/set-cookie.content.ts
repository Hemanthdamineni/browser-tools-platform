/**
 * Editorial content for the set-cookie tool page.
 *
 * Kept out of ``set-cookie.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'One header at a time, in either direction',
      body: 'Analyze takes one Set-Cookie header per line, splits each on semicolons and returns a row per cookie: name, a "Looks secure" or "Review" verdict, the value and the issues found, so a batch pasted from a proxy log reads at a glance. Build takes a name, value and attribute fields and prints a single joined line such as "session=opaque-token; Path=/; SameSite=Lax; Secure; HttpOnly".',
    },
    {
      heading: 'When to build instead of typing the header by hand',
      body: 'Build mode is the dependable way to emit a cookie for an internal API, a webhook callback or a redirect that needs an exact SameSite value, and it validates the name, value, path and domain while refusing a value containing a semicolon or line break.',
    },
    {
      heading: 'The flags the analyzer cares about',
      body: 'A cookie is only reported clean when it carries Secure, HttpOnly, a SameSite of Strict, Lax or None, and a Path. SameSite=None additionally requires Secure, a leading-dot Domain is flagged as obsolete syntax, and a Max-Age that is not a non-negative whole number is called out.',
    },
    {
      heading: 'Where the tool stops and your application begins',
      body: 'No local check can see your HTTPS setup, your login flow, or whether the cookie value is a guessable token, so the verdicts are a checklist rather than a promise. Build mode also refuses SameSite=None without Secure, which matches the dominant browser rule but means you cannot generate that line here for a client you control.',
    },
    {
      heading: 'Nothing is sent, stored or read from your browser',
      body: 'Both directions are pure text work in this tab: a cookie copied from a production response, or one being designed for staging, never leaves the page, and the tool never touches your own cookie jar.',
    },
  ],
  faq: [
    {
      q: 'Does this handle browser cookies?',
      a: 'No. It only formats and analyzes header text locally. It does not read your browser cookie jar, set cookies, or make network requests.',
    },
    {
      q: 'Why are Secure and HttpOnly recommended?',
      a: 'Secure limits transmission to HTTPS, while HttpOnly prevents JavaScript from reading the cookie. Whether they are appropriate depends on the application and deployment.',
    },
    {
      q: 'Is SameSite=None always valid?',
      a: 'Modern browsers generally require SameSite=None cookies to also include Secure. The analyzer flags that combination when Secure is absent.',
    },
  ],
} as const;
