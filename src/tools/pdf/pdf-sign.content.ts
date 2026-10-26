/**
 * Editorial content for the pdf-sign tool page.
 *
 * Kept out of ``pdf-sign.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Draw, type or upload your mark',
      body: 'The sign flow gives you three ways to make a signature: draw it with a mouse, finger or stylus, type a name in one of four built-in styles, or upload a PNG of a signature you already have. The typed styles use fonts already on your device, so nothing is fetched from the web, and the preview shows the placement.',
    },
    {
      heading: 'What flattened really means',
      body: 'The signature is painted into the page content itself with pdf-lib — it is not a form field, a button or a clickable annotation. The result is an ordinary PDF whose page simply contains the signature pixels, so a viewer sees it as part of the page and cannot toggle it off.',
    },
    {
      heading: 'Placement and rotation',
      body: 'Position is given as an x/y point in the browser’s display space (origin top-left, y growing down) and the height always follows the signature’s own aspect ratio, so nothing is stretched. If a mark would end up off the page or need to be shrunk to fit, the tool clamps it back inside and says so.',
    },
    {
      heading: 'What you cannot do here',
      body: 'An encrypted, password-protected PDF cannot be read until it is unlocked, so the tool refuses it rather than guessing. The signature is a bitmap of your mark, not a certificate-based digital signature — there is no PKI chain or tamper-evident digest. For cryptographic signing for compliance, use a dedicated signing service.',
    },
    {
      heading: 'Your mark stays on your device',
      body: 'The signature is drawn in this tab and embedded into the PDF on this machine — nothing is uploaded. Because a signature is not a credential to be synced, it is safest that it never leaves the browser, and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'Is the signature really private?',
      a: 'Yes. Your signature is drawn in this tab and embedded into the PDF on this device — nothing is uploaded.',
    },
    {
      q: 'What does "flattened" mean?',
      a: 'The signature is painted into the page content, so it becomes part of the page itself. It is not a form field or a clickable annotation.',
    },
    {
      q: 'Can I sign a password-protected PDF?',
      a: 'No. Unlock the document first — an encrypted PDF cannot be read until it is decrypted.',
    },
    {
      q: 'Which signature types are supported?',
      a: 'Draw it with a mouse, finger or stylus, type a name in one of four styles, or upload a PNG. Typed signatures use fonts that are already on your device, so nothing is fetched from the web.',
    },
  ],
} as const;
