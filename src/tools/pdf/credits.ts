/**
 * Credit objects for the third-party libraries the PDF tools use.
 *
 * This module must stay dependency-free: `*.meta.ts` files are imported eagerly
 * by `src/lib/registry.ts`, so anything they import lands in the entry chunk of
 * every page. Keeping the credit strings here — instead of in `shared.ts`, which
 * imports `pdf-lib` — is what stops a visitor opening a YAML tool from
 * downloading the PDF engine.
 */

export const pdfCredit = {
  name: 'pdf-lib',
  url: 'https://github.com/Hopding/pdf-lib',
  license: 'MIT',
};
export const pdfjsCredit = {
  name: 'pdfjs-dist',
  url: 'https://github.com/mozilla/pdf.js',
  license: 'Apache-2.0',
};
export const fflateCredit = {
  name: 'fflate',
  url: 'https://github.com/101arrowz/fflate',
  license: 'MIT',
};
