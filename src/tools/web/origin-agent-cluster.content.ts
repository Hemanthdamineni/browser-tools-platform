/**
 * Editorial content for the origin-agent-cluster tool page.
 *
 * Kept out of ``origin-agent-cluster.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A structured boolean, so only two answers are right',
      body: 'Origin-Agent-Cluster has a one-value grammar: ?1 asks the browser to key the agent cluster to the origin, ?0 asks it not to. Analyze compares the pasted text with those two strings and returns a row with the value, a Valid or Invalid verdict and an assessment of the outcome requested. Build prints the trimmed value as a header line and refuses anything else, including the bare 1 or true people type first.',
    },
    {
      heading: 'Reach for it when document.domain is in play',
      body: 'The header is worth checking on any site that still widens its own origin with document.domain, and on pages embedding sibling subdomains that share objects across frames. Requesting ?1 keeps the origin as the cluster key but changes how the page relates to same-site frames, so confirm the exact value the deployment sends and test what depends on legacy behaviour before keeping it fixed: per-response changes cause bugs that show up on one edge node only.',
    },
    {
      heading: 'What ?1 is not',
      body: 'A valid ?1 is an isolation request, not proof of process isolation, and it does not turn on cross-origin isolation by itself. Browsers differ in whether they honour the header and in what they do with it, so the analyzer reports what the value says, not what the browser did. Treat a Valid verdict as confirmation of spelling and intent, never as a security audit.',
    },
    {
      heading: 'Both tokens are checked on your machine',
      body: 'No lookup is fetched and no request is made, so the header you paste and the host it came from stay in the tab while you compare what is deployed against what you meant to deploy.',
    },
  ],
  faq: [
    {
      q: 'What does Origin-Agent-Cluster: ?1 request?',
      a: 'It requests that the document use an origin-keyed agent cluster rather than a site-keyed one, reducing some cross-origin shared-memory exposure.',
    },
    {
      q: 'Does ?1 guarantee process isolation?',
      a: 'No. It is an agent-cluster isolation request, not a universal browser process or cross-origin isolation guarantee.',
    },
    {
      q: 'Can it be changed later?',
      a: 'Changing the value across responses can create compatibility issues; deploy consistently and test pages that use document.domain or related legacy behavior.',
    },
  ],
} as const;
