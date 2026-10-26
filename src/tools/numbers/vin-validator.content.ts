/**
 * Editorial content for the vin-validator tool page.
 *
 * Kept out of ``vin-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Structure, check digit and meaning',
      body: 'Paste a 17-character VIN and it is validated against the ISO 3779/NHTSA rules, then broken into a table: the WMI at positions 1–3 with its world region, the vehicle descriptor at 4–8, the check digit at position 9, the model-year code at 10, the assembly plant at 11 and the serial at 12–17. Illegal letters, a wrong length and a check-digit mismatch are each named as an issue.',
    },
    {
      heading: 'The first check on a used car',
      body: 'Run it on the VIN from a classified ad: a mismatch or an illegal character is a strong sign the number was mistyped or invented, and the model-year and plant rows are quick sanity checks against what the seller claims.',
    },
    {
      heading: 'The three modes',
      body: 'Decode and validate is the default and shows the structure table plus any issues. Checksum only answers a single valid-or-invalid question. Complete a VIN with check digit takes the body with position 9 treated as 0 and computes the correct digit, writing X when the remainder is 10.',
    },
    {
      heading: 'Caveats',
      body: 'No manufacturer database is queried, so the model year is derived from the standard year code plus any 30-year interval, and the tool says a chart is needed where the code is ambiguous. Vehicles from markets that put a serial number in position 9 will fail the checksum while still being genuine. The WMI row names a region, not a manufacturer.',
    },
    {
      heading: 'No lookup, no upload',
      body: 'Everything is computed from the characters you paste, in your browser; the VIN is never sent to a server or to any vehicle-history service. It works with no connection.',
    },
  ],
  faq: [
    {
      q: 'What makes a VIN valid?',
      a: 'Exactly 17 characters from 0–9 and A–Z excluding I, O and Q, plus a check digit at position 9 that matches the weighted sum (mod 11).',
    },
    {
      q: 'Can the check digit be X?',
      a: 'Yes — the remainder 10 is written as the letter X, which is the only allowed letter in position 9.',
    },
    {
      q: 'Do all VINs use the check digit?',
      a: 'Vehicles built for the US market do. Some other markets historically use a serial number in position 9, so a checksum mismatch alone does not always mean a fake VIN.',
    },
  ],
} as const;
