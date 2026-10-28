import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'email-header-analyzer',
  name: 'Email Header Analyzer',
  category: 'security',
  summary:
    'Analyze email headers: delivery hops and delays, SPF, DKIM and DMARC results, addresses.',
  description:
    'Paste a message header block or drop an .eml file and see how the mail actually travelled: every Received hop in delivery order with the delay between them, SPF, DKIM and DMARC verdicts with their sources, the addresses behind each role, spam scores, and any timestamp or domain mismatch that suggests spoofing. Encoded-words in subjects and display names are decoded for you.',
  keywords: [
    'email header analyzer',
    'email headers',
    'spf dkim dmarc',
    'received headers',
    'email hop delay',
    'phishing analysis',
    'mail header parser',
    'deliverability',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.eml,.txt,message/rfc822,text/plain',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'overview', label: 'Overview' },
        { value: 'hops', label: 'Delivery hops' },
        { value: 'auth', label: 'Authentication results' },
        { value: 'addresses', label: 'Addresses' },
        { value: 'raw', label: 'All headers' },
      ],
      default: 'overview',
    },
    {
      key: 'decodeWords',
      label: 'Decode encoded-words (subjects, names)',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A message with two hops',
      input:
        'Return-Path: <alice@example.com>\nReceived: from mail.example.com (mail.example.com [192.0.2.10])\n\tby mx.google.com with ESMTPS id abc123\n\tfor <bob@example.org>; Tue, 1 Oct 2024 10:00:05 +0000\nReceived: from localhost (localhost [127.0.0.1]) by mail.example.com\n\twith ESMTP id def456; Tue, 1 Oct 2024 10:00:00 +0000\nAuthentication-Results: mx.google.com; spf=pass smtp.mailfrom=alice@example.com;\n\tdkim=pass header.i=@example.com; dmarc=pass header.from=example.com\nFrom: Alice Example <alice@example.com>\nTo: Bob <bob@example.org>\nSubject: =?UTF-8?B?w4TDpMOWw7w=?= report\nDate: Tue, 1 Oct 2024 10:00:04 +0000\nMessage-ID: <abc123@example.com>',
    },
  ],
  faq: [
    {
      q: 'Which order are the hops shown in?',
      a: 'Received headers are written newest first, so they are reversed into delivery order: hop 1 is where the message was first accepted and each later row is closer to you. The delay column is the time taken to move from the previous row to that one.',
    },
    {
      q: 'What do the authentication results mean?',
      a: 'They are read from Authentication-Results, ARC-Authentication-Results and Received-SPF headers and report what the receiving server decided: pass, fail, softfail, neutral or none. The source column records which server made the judgement, because a verdict only means something coming from a server you trust.',
    },
    {
      q: 'Why are there several SPF or DKIM rows?',
      a: 'Every server that handled the message can add its own Authentication-Results header, and forwarding usually adds more. Rows are listed in the order found, so the topmost header (the last one added, by your own mail provider) is normally the most relevant.',
    },
    {
      q: 'Is a From and Return-Path mismatch proof of spoofing?',
      a: 'No. Mailing lists, contact forms and bulk senders routinely differ, which is why it is reported as a warning rather than a verdict. Combine it with the DMARC result and the received chain before drawing a conclusion.',
    },
  ],
  related: [  "email-validator",
  "security-headers",
  "x509-certificate-inspector",
  "hex"],
  status: 'stable',
};
