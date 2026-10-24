import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mbox-archive-analyzer',
  name: 'mbox Archive Analyzer',
  category: 'data',
  summary: 'Analyze an mbox mail archive: messages, senders, attachments, flags and archive problems.',
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
  ],
  faq: [
    {
      q: 'How is the archive split into messages?',
      a: 'On the From_ separator line, exactly as a mail reader does: a line that begins with "From " at the start of a line starts a new message. Everything before the first one is reported as a preamble rather than silently thrown away, and a From line that appears where a header line should be is reported too.',
    },
    {
      q: 'What happens to >From lines in message bodies?',
      a: 'They are unescaped the way an mboxrd reader unescapes them, so a body that was written as ">From the desk of" is shown as "From the desk of". The number of escaped lines is counted and reported, because an archive that escapes them and one that does not can be confused for each other.',
    },
    {
      q: 'Are attachments decoded?',
      a: 'Yes, in memory only. Base64 and quoted-printable payloads are decoded to give the real size of each attachment, and the reported size is the decoded size rather than the size of the encoded text, which is roughly a third larger.',
    },
    {
      q: 'Can it open a Maildir or a single .eml file?',
      a: 'A single .eml file has no From_ separator, so it is read as one message and the analyzer tells you it found only one. Maildir directories are not an archive format this tool reads; concatenate the files in cur/ and new/ into an mbox first, or inspect one message with the Email Header Analyzer.',
    },
  ],
  related: ['email-header-analyzer', 'csv-profiler', 'ndjson', 'access-log-analyzer'],
  status: 'stable',
};
