/**
 * Single source of truth for branding, URLs and navigation.
 * Rename the product by editing `name` / `domain` here — nothing else hard-codes them.
 */

const DEFAULT_URL = 'https://toolbench.app';

export const site = {
  name: 'Toolbench',
  /** Shown in the header next to the logo. */
  shortName: 'Toolbench',
  tagline: 'Fast, private tools that run in your browser',
  description:
    'A large collection of file and text utilities that run entirely on your device. ' +
    'No uploads, no accounts, no tracking. Works offline once loaded.',
  /** Canonical origin. Override at build with SITE_URL. */
  url: import.meta.env.SITE_URL ?? DEFAULT_URL,
  locale: 'en',
  themeColor: '#1d1d1b',
  backgroundColor: '#faf9f7',
  repository: 'https://github.com/toolbench/toolbench',
  /** Optional: leave empty to hide social links. */
  social: {
    github: 'https://github.com/toolbench/toolbench',
  },
  nav: [
    { label: 'All tools', href: '/tools' },
    { label: 'Categories', href: '/categories' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'About', href: '/about' },
  ],
  footer: {
    Product: [
      { label: 'All tools', href: '/tools' },
      { label: 'Categories', href: '/categories' },
      { label: 'Install as an app', href: '/about#install' },
    ],
    Trust: [
      { label: 'Privacy model', href: '/privacy' },
      { label: 'How it works', href: '/about#how' },
      { label: 'Open source', href: 'https://github.com/toolbench/toolbench' },
    ],
  },
} as const;

export type Site = typeof site;
