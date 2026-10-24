import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cross-origin-embedder-policy',
  name: 'Cross-Origin-Embedder-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect cross-origin resource embedding controls.',
  description:
    'Generate or analyze Cross-Origin-Embedder-Policy values. Validates unsafe-none, require-corp, credentialless, and credentialless=* forms, explains COEP interactions with CORP and CORS, and highlights cross-origin-isolation compatibility locally.',
  keywords: [
    'Cross-Origin-Embedder-Policy',
    'COEP',
    'require-corp',
    'credentialless',
    'cross-origin isolation',
    'CORP',
    'CORS',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze policy' },
        { value: 'build', label: 'Build policy' },
      ],
    },
    {
      key: 'value',
      label: 'Policy',
      type: 'select',
      default: 'require-corp',
      choices: [
        { value: 'unsafe-none', label: 'unsafe-none' },
        { value: 'require-corp', label: 'require-corp' },
        { value: 'credentialless', label: 'credentialless' },
        { value: 'credentialless=*', label: 'credentialless=*' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze strict embedding policy', input: 'require-corp' },
    { title: 'Build a credentialless policy', options: { mode: 'build', value: 'credentialless' } },
    { title: 'Analyze a value the header does not allow', input: 'same-origin' },
  ],
  article: [
    {
      heading: 'Four accepted values, one of them the default non-policy',
      body: 'Cross-Origin-Embedder-Policy accepts only unsafe-none, require-corp, credentialless and credentialless=*. Analyze matches your text case-insensitively and returns one row with the value, a Valid or Invalid verdict and an assessment; build normalises the selected token to lower case and prints the response line. A plausibly spelled token such as same-origin is reported invalid rather than guessed at.',
    },
    {
      heading: 'The moment you want it: an asset that stopped loading',
      body: 'The header usually appears when someone enables cross-origin isolation for SharedArrayBuffer, timers or WebAssembly threads, and a font, image or embed from another origin stops rendering. Pasting require-corp into analyze confirms what the document asks for and spells out the consequence: each cross-origin subresource must opt in with Cross-Origin-Resource-Policy or a CORS response.',
    },
    {
      heading: 'Choosing between require-corp and credentialless',
      body: 'require-corp is the strictest value and the likeliest to break a widget that has not opted in. The two credentialless forms keep no-CORS requests working without credentials, a compatibility compromise rather than a guarantee: the tool accepts both spellings and labels them as credentialless embedding, but cannot predict browser support or whether a vendor asset will load. unsafe-none is the absence of a restriction, not a recommendation.',
    },
    {
      heading: 'A header is a request, never an isolation guarantee',
      body: 'Nothing here verifies that isolation took effect: COEP only works alongside Cross-Origin-Opener-Policy on the document and matching policies on the subresources, and the check covers token spelling, not your deployment. Confirm the value you intend to ship, then test the real pages.',
    },
    {
      heading: 'The policy string is inspected locally',
      body: 'Analysis and generation run inside this page, so a policy string copied from an internal staging origin is never uploaded and no request leaves the tab.',
    },
  ],
  faq: [
    {
      q: 'What does require-corp do?',
      a: 'It requires cross-origin resources to explicitly opt in through CORP or CORS before the document can embed them.',
    },
    {
      q: 'What does credentialless change?',
      a: 'It permits some no-CORS cross-origin resources without credentials, reducing credential leakage while preserving more compatibility than require-corp in some cases.',
    },
    {
      q: 'Does COEP alone enable cross-origin isolation?',
      a: 'No. Cross-origin isolation generally also needs compatible COOP and resource response policies, plus browser support.',
    },
  ],
  related: ['cross-origin-opener-policy', 'cross-origin-resource-policy', 'permissions-policy'],
  status: 'stable',
};
