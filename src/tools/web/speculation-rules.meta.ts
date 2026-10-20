import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'speculation-rules',
  name: 'Speculation Rules Analyzer',
  category: 'web',
  summary: 'Validate and build prefetch/prerender speculation rules.',
  description: 'Analyze and generate Speculation Rules (also called speculationrules), the modern mechanism to prefetch and prerender pages. Supports the Speculation-Rules response header, an external JSON file, or an inline JSON object. Validates the prefetch and prerender rule schemas — source lists, URL patterns, eagerness, requires/anonymousClientIPWhitelisted, and referrer policy. Build mode produces ready-to-serve JSON.',
  keywords: ['speculation rules', 'speculationrules', 'prefetch', 'prerender', 'Speculation-Rules header', 'eagerness', 'URL patterns', 'requires', 'source list', 'referrer policy', 'prerender and prefetch JSON'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze rules' }, { value: 'build', label: 'Build rules JSON' }] },
    { key: 'type', label: 'Rule type', type: 'select', default: 'prefetch', choices: [{ value: 'prefetch', label: 'Prefetch' }, { value: 'prerender', label: 'Prerender' }] },
    { key: 'urls', label: 'Relative URLs (comma-separated)', type: 'text', default: '/next, /about' },
    { key: 'eagerness', label: 'Eagerness', type: 'select', default: 'moderate', choices: [{ value: 'immediate', label: 'Immediate' }, { value: 'eager', label: 'Eager' }, { value: 'moderate', label: 'Moderate' }, { value: 'conservative', label: 'Conservative' }] },
  ],
  examples: [
    { title: 'Analyze a prerender rule', input: '{"prerender":[{"source":"list","urls":["/next"]}],"prefetch":[{"source":"list","urls":["/about"]}]}' },
    { title: 'Build prefetch rules JSON', options: { mode: 'build', type: 'prefetch', urls: '/next, /about' } },
  ],
  faq: [
    { q: 'Where does this header go?', a: 'Serve a Speculation-Rules header naming an external JSON file, or inline the rules with a <script type="speculationrules"> element.' },
    { q: 'What is eagerness?', a: 'How eagerly the browser starts prefetching/prerendering: from immediate/eager down to moderate/conservative.' },
    { q: 'Why prerender over prefetch?', a: 'Prerender renders the page up front for faster navigation but costs more resources; prefetch only warms the network response.' },
  ],
  related: ['web-manifest', 'prioritize-lcp', 'early-hints'],
  status: 'stable',
};
