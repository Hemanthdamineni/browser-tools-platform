/**
 * Evergreen guides under /guides — single source of truth for their titles,
 * summaries and paths. The prose lives in the pages themselves; this module
 * only wires up the index, the per-page metadata and the Article JSON-LD.
 */
import { site } from './site';
import { absoluteUrl } from './seo';

export interface Guide {
  /** Route path, e.g. `/guides/base64-explained`. */
  path: string;
  title: string;
  description: string;
  /** One-line blurb for the index cards. */
  summary: string;
}

export const GUIDES: Guide[] = [
  {
    path: '/guides/base64-explained',
    title: 'Base64 explained: what it is and when to use it',
    description:
      'What Base64 encoding actually does, why it makes data about a third bigger, and when the URL-safe alphabet is the right choice.',
    summary:
      'Why a 3 MB file becomes 4 MB of text, what the padding means, and when to use base64url instead.',
  },
  {
    path: '/guides/which-hash',
    title: 'Which hash should I use?',
    description:
      'MD5, SHA-1, SHA-256 or SHA-512: what each is good for, why MD5 is unsafe for passwords, and when you need HMAC instead.',
    summary:
      'Picking between MD5, SHA-1, SHA-256 and SHA-512 — and why none of them belongs in a password field.',
  },
  {
    path: '/guides/cron-cheat-sheet',
    title: 'Cron syntax cheat sheet',
    description:
      'Every cron field, the operators that combine them, the schedules worth memorising, and how cron differs from a systemd timer.',
    summary:
      'Every field, every operator, the schedules worth memorising, and cron versus systemd timers.',
  },
  {
    path: '/guides/color-contrast-wcag',
    title: 'Colour contrast and WCAG',
    description:
      'The WCAG AA and AAA contrast ratios, how the number is calculated, how to check it, and the contrast mistakes that ship most often.',
    summary:
      'The AA and AAA ratios, how they are calculated, and the contrast mistakes that ship most often.',
  },
];

export function getGuide(path: string): Guide {
  const guide = GUIDES.find((g) => g.path === path);
  if (!guide) throw new Error(`Unknown guide: ${path}`);
  return guide;
}

/** Article JSON-LD for a guide page. */
export function guideJsonLd(guide: Guide) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    url: absoluteUrl(guide.path),
    inLanguage: site.locale,
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: site.name, url: site.url },
  };
}
