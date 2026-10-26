/**
 * Editorial content for the mbox-archive-analyzer tool page.
 *
 * Kept out of ``mbox-archive-analyzer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reads from an mbox',
      body: 'Drop in an mbox file — the plain-text mailbox format used by Thunderbird, mutt, procmail and many mail backups — and this tool splits it on the From_ separator lines that begin each message. For every message it unfolds and decodes the headers, including RFC 2047 encoded words, walks the MIME tree to list attachments with their real decoded sizes, and reads the Status and X-Status flags that track read and replied state.',
    },
    {
      heading: 'The five output views',
      body: 'The format option switches between an archive summary, a per-message listing, a sender ranking, an attachment list and a findings report. The summary gives counts and totals at a glance; senders ranks who appears most; attachments shows each file with its decoded byte size; and findings lists the problems that make a mailbox hard to trust. The top option limits how many rows the ranked views show, from 3 to 50.',
    },
    {
      heading: 'What the findings check for',
      body: 'The tool reports messages with no Date or From, dates that will not parse, duplicate Message-IDs, replies whose parent message is missing, escaped From lines left over from mboxrd, base64 payloads with broken padding, and a body that no reader could split because the blank line after the headers is missing. Each finding is the kind of thing that quietly breaks a mailbox export or a migration tool.',
    },
    {
      heading: 'Limits and practical bounds',
      body: 'A single .eml file has no From_ separator, so it is read as one message. Large archives are capped at 16 MB, 5000 messages and a bounded number of MIME parts, and very long header values are clipped in the display so the report stays readable. Maildir directories are not an archive format this tool reads — concatenate cur/ and new/ into an mbox first.',
    },
    {
      heading: 'Nothing is uploaded or executed',
      body: 'The file is parsed entirely in your browser. No content is uploaded, no message body is ever executed, and the tool works offline — which matters when the mailbox you are inspecting is private correspondence.',
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
} as const;
