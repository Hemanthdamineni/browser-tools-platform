import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mbox-archive-analyzer',
  name: 'mbox Archive Analyzer',
  category: 'data',
  summary:
    'Analyze an mbox mail archive: messages, senders, attachments, flags and archive problems.',
  description:
    'Drop an mbox file from Thunderbird, mutt, procmail or a mail backup and see what is inside it. The analyzer splits the archive on its From_ separator lines, unfolds and decodes headers (including RFC 2047 encoded words), walks the MIME tree to list attachments with their real decoded sizes, reads the Status and X-Status flags, and reports the archive-level problems that make a mailbox hard to trust: messages with no Date or From, dates that do not parse, duplicate Message-IDs, replies whose parent is missing, escaped From lines left over from mboxrd, base64 payloads with broken padding, and a body that no reader could split because a blank line is missing after the headers. Nothing is uploaded and nothing is executed.',
  keywords: [
    'mbox',
    'mail archive',
    'mailbox analyzer',
    'thunderbird mbox',
    'email attachments',
    'from_ separator',
    'mboxrd',
    'mail backup inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'summary', label: 'Archive summary' },
        { value: 'messages', label: 'Messages' },
        { value: 'senders', label: 'Senders' },
        { value: 'attachments', label: 'Attachments' },
        { value: 'findings', label: 'Findings' },
      ],
      default: 'summary',
    },
    {
      key: 'top',
      label: 'Rows in ranked views',
      type: 'number',
      default: 10,
      min: 3,
      max: 50,
      step: 1,
    },
  ],
  examples: [
    {
      title: 'Two messages with an attachment',
      input:
        'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <a1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Quarterly numbers\nDate: Mon, 6 Jan 2025 09:12:04 +0000\nStatus: RO\n\nHere are the numbers.\n\nFrom bob@example.com Mon Jan  6 11:30:00 2025\nMessage-ID: <b2@example.com>\nFrom: Bob <bob@example.com>\nTo: Alice <alice@example.com>\nSubject: Re: Quarterly numbers\nDate: Mon, 6 Jan 2025 11:30:00 +0000\nIn-Reply-To: <a1@example.com>\nContent-Type: text/plain; charset=utf-8\n\nThanks, got it.\n',
    },
    {
      title: 'Rank senders by volume',
      input:
        'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <a1@example.com>\nFrom: Alice <alice@example.com>\nDate: Mon, 6 Jan 2025 09:12:04 +0000\n\nOne\n\nFrom bob@example.com Mon Jan  6 11:30:00 2025\nMessage-ID: <b2@example.com>\nFrom: Bob <bob@example.com>\nDate: Mon, 6 Jan 2025 11:30:00 +0000\n\nTwo\n\nFrom alice@example.com Mon Jan  6 13:00:00 2025\nMessage-ID: <a3@example.com>\nFrom: Alice <alice@example.com>\nDate: Mon, 6 Jan 2025 13:00:00 +0000\n\nThree\n',
      options: { format: 'senders', top: 5 },
    },
    {
      title: 'List attachments',
      input:
        'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <a1@example.com>\nFrom: Alice <alice@example.com>\nDate: Mon, 6 Jan 2025 09:12:04 +0000\nContent-Type: multipart/mixed; boundary="bound"\n\n--bound\nContent-Type: text/plain\n\nSee attached.\n--bound\nContent-Type: application/pdf; name="doc.pdf"\nContent-Transfer-Encoding: base64\n\nJVBERi0xLjEK\n--bound--\n',
      options: { format: 'attachments' },
    },
  ],
  related: ['email-header-analyzer', 'csv-profiler', 'ndjson', 'access-log-analyzer'],
  status: 'stable',
};
