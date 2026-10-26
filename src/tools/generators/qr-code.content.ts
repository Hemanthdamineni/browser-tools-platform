/**
 * Editorial content for the qr-code tool page.
 *
 * Kept out of ``qr-code.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Type a string and get a QR code back as an SVG data URI, shown inline and saved as qr.svg. The content-type option shapes the payload: plain text or a URL pass through, Wi-Fi builds WIFI:T:…;S:…;P:…;; with special characters escaped, and email, sms, geo and tel prefix mailto:, smsto:, geo: or tel:. Stats report the module grid, the pixel size and the level used.',
    },
    {
      heading: 'When to use it',
      body: 'Printing a code for the office network is the classic case: choose Wi-Fi, enter the network name and password, then drop the SVG into a label. The vector file scales to any print size.',
    },
    {
      heading: 'Tuning the output',
      body: 'Error correction trades capacity for resilience: L holds the most data and H the least, but H survives scuffs and partial coverage. Module size sets pixels per square from 2 to 16, the quiet zone sets the white border from 0 to 8 modules, and the dark and light fields take any hex colour from #rgb to #rrggbbaa.',
    },
    {
      heading: 'Limits',
      body: 'The payload must fit a single code; long text raises an error suggesting you shorten it or lower the error-correction level. Colour fields reject anything that is not a hex value, and there is no option to overlay a centre logo on the code.',
    },
    {
      heading: 'Privacy',
      body: 'The code is generated in this tab with no network call, so nothing you type is uploaded. Keep in mind that a Wi-Fi payload is readable by anyone who scans the image, so treat the SVG like the password itself.',
    },
  ],
  faq: [
    {
      q: 'Why SVG?',
      a: 'SVG scales to any size without blurring, and the file is tiny. Paste it into a design tool or embed it directly in a page.',
    },
    {
      q: 'Which error-correction level should I pick?',
      a: 'M is the usual default. Choose H when the code may be printed small, worn, or partly covered — higher levels let scanners still decode a damaged code.',
    },
    {
      q: 'How do I make the code bigger?',
      a: 'Raise the module size (2 to 16 px per square) or the quiet zone (0 to 8 modules). The stats line reports the final pixel dimensions, and as the output is SVG you can also scale it later without loss.',
    },
  ],
} as const;
