/**
 * Editorial content for the email-header-analyzer tool page.
 *
 * Kept out of ``email-header-analyzer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Following a message from sender to inbox',
      body: 'Paste a raw header block or drop an .eml file and the tool parses the Name: value lines, including folded continuations, then reports according to the Output setting. Overview gives address roles, a delivery summary, authentication verdicts and timing warnings; Delivery hops lists each Received header in delivery order with the delay between them; Authentication results tabulates every SPF, DKIM and DMARC verdict; Addresses lists From, To, Reply-To and the rest; All headers dumps everything found.',
    },
    {
      heading: 'Answering where a message really came from',
      body: 'It is built for a suspected phishing email, a support ticket where mail arrived late, or a deliverability problem. The hop chain shows which server introduced the delay, and the authentication rows show whether the receiving server genuinely passed SPF, DKIM and DMARC.',
    },
    {
      heading: 'The one real option',
      body: 'Decode encoded-words is on by default and turns =?UTF-8?B?...?= sequences in subjects and display names back into readable text, dropping whitespace between adjacent encoded words as RFC 2047 requires. Turn it off to see the header exactly as it arrived.',
    },
    {
      heading: 'Reading the results carefully',
      body: 'Hops are shown oldest-first even though Received headers are written newest-first, and each delay is the gap from the previous row. Several authentication rows are normal because every server may add its own. A From and Return-Path domain mismatch is a warning, not a verdict. Input is capped at 5 MB and 2000 headers.',
    },
    {
      heading: 'Headers are analysed in the tab',
      body: 'The header block is parsed inside your browser and never uploaded. That matters because headers carry real addresses, message ids and internal server names, so a phishing report stays between you and your machine.',
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
} as const;
