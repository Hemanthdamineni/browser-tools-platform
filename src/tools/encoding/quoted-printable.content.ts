/**
 * Editorial content for the quoted-printable tool page.
 *
 * Kept out of ``quoted-printable.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'The mode option picks a direction. Encode converts text to MIME quoted-printable, escaping bytes that would not survive 7-bit transport as =XX while wrapping at 75 tokens per line with a trailing = soft break. Decode reverses that, removing the soft breaks and folding every =XX back into its byte. The output renders as plain text for decode and as a code block for encode.',
    },
    {
      heading: 'When to use it',
      body: 'Reach for it when an email client or an old mail pipeline mangled a message: copy the raw quoted-printable body straight out of the message source and decode it here to recover the readable text, including non-ASCII accents and emoji.',
    },
    {
      heading: 'Line breaking',
      body: 'Encoding wraps at 76 characters per physical line by inserting a soft line break, an equals sign at the very end of the line that decoding removes. Trailing spaces and tabs at the end of a line are escaped too, because a 7-bit transport would strip them.',
    },
    {
      heading: 'What stays readable',
      body: 'ASCII letters, digits and most punctuation pass through unchanged; only the bytes outside that range get the =XX form. That is the point of the encoding, which is defined by RFC 2045 and used in MIME email bodies.',
    },
    {
      heading: 'Privacy',
      body: 'Encoding and decoding are pure string work in the tab, so the payload never leaves the page and the tool works offline. That keeps the content of private mail threads or pasted message bodies local.',
    },
  ],
  faq: [
    {
      q: 'What is a soft line break?',
      a: 'An = at the very end of a line means "this line continues" — it is removed on decode. Encoding wraps at 76 characters using soft breaks.',
    },
    {
      q: 'What does =XX mean?',
      a: 'It is the hex value of one byte, so =E9 is the byte 0xE9. Decoding collects these bytes and interprets them as UTF-8 text, which is how accented letters and symbols survive.',
    },
    {
      q: 'Can I paste a whole MIME header or body?',
      a: 'Yes, decode a body as-is. Header word-encoded text uses a different scheme and is not handled, so paste only the quoted-printable content itself.',
    },
  ],
} as const;
