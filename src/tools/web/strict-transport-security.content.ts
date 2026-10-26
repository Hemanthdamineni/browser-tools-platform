/**
 * Editorial content for the strict-transport-security tool page.
 *
 * Kept out of ``strict-transport-security.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the HSTS header tells a browser',
      body: 'Strict-Transport-Security is a response header that tells a browser to keep using HTTPS for an origin and never fall back to plain HTTP. It is honoured only after the browser has already seen a valid HTTPS response — by design the header is ignored when it arrives over plain HTTP — and then only for the duration named by max-age, in seconds. Build mode assembles a header from a max-age and a choice of directives, and analyze mode reads whatever value a server is sending and reports each directive with a verdict.',
    },
    {
      heading: 'The directives and what they mean',
      body: 'The mandatory max-age is how long, in seconds, the browser will enforce HTTPS for that origin; a non-negative integer is required and anything else is flagged. includeSubDomains extends the policy to every subdomain, so api.example.com inherits it from example.com, and preload is the flag that lets the origin be submitted to the browser preload lists, which enforce HTTPS even before the first visit. Each token in a pasted header is classified as one of these or reported as unknown, and a duplicate directive is called out because a browser would keep the first and drop the rest.',
    },
    {
      heading: 'Why the analysis flags certain combinations',
      body: 'The preload lists have their own rules, and the tool applies them so you can see whether a header would be accepted for submission: a max-age under one year, 31,536,000 seconds, is flagged as ineligible, and preload without includeSubDomains is reported as a problem, because a preload submission requires includeSubDomains. A missing max-age is treated as the real defect it is, since the browser has nothing to act on, while a short max-age is a deliberate trade-off that the analysis points out rather than forbids.',
    },
    {
      heading: 'What it does not do and where it runs',
      body: 'HSTS is a first-visit guarantee only, and nothing here removes a policy a browser has already cached: only the origin owner can revoke it, and clients must honour it until max-age expires. The tool builds and validates header text locally, making no request and hashing nothing, so a policy you are drafting or a header you are debugging is handled entirely in the tab, offline if you like.',
    },
  ],
  faq: [
    {
      q: 'What does HSTS do?',
      a: 'It tells the browser to only use HTTPS for the origin (and subdomains when includeSubDomains is set), preventing protocol-downgrade attacks after the first visit.',
    },
    {
      q: 'Can I reduce max-age later?',
      a: 'max-age=0 revokes HSTS for the requesting browser, but clients that already cached the policy must honor it until it expires.',
    },
    {
      q: 'What is required for the preload list?',
      a: "Chrome's HSTS preload submissions require max-age of at least 31,536,000 seconds (one year) and includeSubDomains.",
    },
  ],
} as const;
