/**
 * Editorial content for the vcard tool page.
 *
 * Kept out of ``vcard.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Build a card or take one apart',
      body: 'Build mode fills in a vCard 3.0 card from separate fields — names, organisation, job title, email, phone, website, address and note — and emits the .vcf text you save or attach. Parse mode does the reverse: paste an existing vCard and each recognised property is listed as a row, so you can read a card someone sent you without importing it anywhere.',
    },
    {
      heading: 'What the generated file looks like',
      body: 'The output follows the vCard 3.0 layout (RFC 2426): BEGIN:VCARD, VERSION:3.0, a structured N line of last;first;;;, then FN, ORG, TITLE, EMAIL;TYPE=INTERNET, TEL;TYPE=CELL, URL, an ADR;TYPE=HOME with the address in the street slot, and NOTE. Empty fields are omitted entirely, so the card only carries what you actually entered. Values are escaped per the spec — backslashes, semicolons and commas, and newlines become \\n — so an address with a comma in it stays intact.',
    },
    {
      heading: 'Reading a card you were sent',
      body: 'Parse mode recognises the nine properties this tool emits, plus any other vCard that uses them, and shows each as a field/value row after unescaping. It skips BEGIN/END markers and outlines it does not model, so a card with a birthday or a photo simply shows the fields it understands rather than failing. If no vCard-shaped lines are present it says so instead of showing an empty table.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Version 3.0 is chosen for the broadest compatibility — iOS, Android, Outlook and Google Contacts all import it — and the tool does not emit vCard 4.0-only constructs. In build mode you need at least a name or an email, and one card is produced per run; parse mode reads the first block’s properties. Nothing leaves the browser, so a contact’s phone number and address stay on your device.',
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
    {
      q: 'Why is a value like a comma escaped?',
      a: 'vCard 3.0 reserves commas and semicolons as list separators, so the tool escapes them with a backslash to keep a single address or name field intact when another application imports it.',
    },
  ],
} as const;
