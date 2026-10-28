import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'vcard',
  name: 'vCard Generator',
  category: 'generators',
  summary: 'Build vCard 3.0 contact files, or parse a pasted vCard back into fields.',
  description:
    'Create a .vcf contact card you can import into any address book, or paste an existing vCard and read its fields as a table. Fully on-device — nothing is uploaded.',
  keywords: ['vcard', 'vcf', 'contact card', 'address book', 'business card', 'contact generator'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'build',
      choices: [
        { value: 'build', label: 'Build a vCard' },
        { value: 'parse', label: 'Parse a vCard' },
      ],
    },
    {
      key: 'firstName',
      label: 'First name',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'lastName',
      label: 'Last name',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'org',
      label: 'Organization',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'jobTitle',
      label: 'Job title',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'website',
      label: 'Website',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'address',
      label: 'Address',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'note',
      label: 'Note',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
  ],
  examples: [
    {
      title: 'Simple contact',
      options: { mode: 'build', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.io' },
    },
    {
      title: 'Full contact',
      options: {
        mode: 'build',
        firstName: 'Grace',
        lastName: 'Hopper',
        org: 'US Navy',
        jobTitle: 'Rear Admiral',
        email: 'grace@navy.mil',
        phone: '+1 555 0100',
      },
    },
  ],
  faq: [
    {
      q: 'Which vCard version is generated?',
      a: 'vCard 3.0 (RFC 2426) — the most widely compatible format, supported by iOS, Android, Outlook and Google Contacts.',
    },
    {
      q: 'Where can I use the output?',
      a: 'Save it as a .vcf file, attach it to an email, host it on your site, or pair it with the QR Code Generator to make a scannable contact card.',
    },
  ],
  related: [  "ical-event",
  "qr-code",
  "meta-tags"],
  status: 'stable',
};
