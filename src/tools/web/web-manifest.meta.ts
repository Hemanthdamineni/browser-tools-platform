import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'web-manifest',
  name: 'Web App Manifest Generator & Validator',
  category: 'web',
  summary: 'Generate or validate a web app manifest for installable sites.',
  description:
    'Create a minimal Web App Manifest JSON from common fields, or validate pasted manifest JSON for required values, types, and common installability mistakes. Validation is advisory and depends on browser, page, and deployment requirements.',
  keywords: [
    'web app manifest',
    'manifest.json generator',
    'site.webmanifest',
    'PWA manifest validator',
    'progressive web app manifest',
    'web manifest json',
    'installable web app',
    'manifest icons',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'validate',
      choices: [
        { value: 'validate', label: 'Validate JSON manifest' },
        { value: 'generate', label: 'Generate from fields' },
      ],
    },
    { key: 'name', label: 'App name', type: 'text', default: 'My Web App' },
    { key: 'shortName', label: 'Short name', type: 'text', default: 'My App' },
    { key: 'startUrl', label: 'Start URL', type: 'text', default: '/' },
    {
      key: 'display',
      label: 'Display mode',
      type: 'select',
      default: 'standalone',
      choices: ['standalone', 'fullscreen', 'minimal-ui', 'browser'].map((value) => ({
        value,
        label: value,
      })),
    },
    { key: 'themeColor', label: 'Theme colour', type: 'text', default: '#ffffff' },
    { key: 'backgroundColor', label: 'Background colour', type: 'text', default: '#ffffff' },
    { key: 'scope', label: 'Scope (optional)', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Validate manifest',
      input:
        '{"name":"Notes","short_name":"Notes","start_url":"/","display":"standalone","icons":[{"src":"/icons/192.png","sizes":"192x192","type":"image/png"}]}',
    },
    {
      title: 'Generate manifest',
      input: '',
      options: { mode: 'generate', name: 'Field Notes', shortName: 'Notes', startUrl: '/app/' },
    },
    {
      title: 'Generate a fullscreen dashboard manifest',
      input: '',
      options: {
        mode: 'generate',
        name: 'Dashboard',
        shortName: 'Dash',
        startUrl: '/dashboard/',
        display: 'fullscreen',
        scope: '/dashboard/',
      },
    },
  ],
  related: ['robots-txt', 'meta-tags', 'json-format'],
  status: 'stable',
};
