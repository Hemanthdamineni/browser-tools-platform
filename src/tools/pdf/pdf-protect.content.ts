/**
 * Editorial content for the pdf-protect tool page.
 *
 * Kept out of ``pdf-protect.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What comes back',
      body: 'Drop an unprotected PDF and give the password that should open it. The tool returns a copy of the file, named after the original with -protected.pdf appended, encrypted with AES-256 at PDF revision 6. Before handing it over it verifies that the result really carries an /Encrypt dictionary.',
    },
    {
      heading: 'One password or two',
      body: 'The user password opens the file; the optional owner password lets its holder change the permissions later. Leave the owner field empty and both roles share one secret. Each password may be at most 127 bytes, the longest revision 6 reads — beyond that a reader can never match it.',
    },
    {
      heading: 'The three permission switches',
      body: 'Allow printing, Allow copying text and images, and Allow editing all start enabled. Turning one off writes the matching restriction into the PDF, and the result card lists exactly what is now blocked. Accessibility extraction is never restricted, so screen readers keep working even when copying is off.',
    },
    {
      heading: 'Read this before you protect anything',
      body: 'A forgotten password means a file that can never be opened again: it is the only key and it is stored nowhere. An already-protected PDF is refused rather than re-encrypted, files over 100 MB are rejected, and the flags are a request to the reader, not cryptographic enforcement.',
    },
    {
      heading: 'The encryption engine runs in your browser',
      body: 'qpdf is compiled to WebAssembly and executed in this tab, so the PDF and both passwords stay on your machine. Nothing is uploaded, the page contacts no server, and it works offline once loaded.',
    },
  ],
  faq: [
    {
      q: 'What happens if I forget the password?',
      a: 'The file cannot be opened again. The password is the only key and it is not stored anywhere — there is no recovery service and no back door. Keep it somewhere safe before you delete the original.',
    },
    {
      q: 'Which encryption is used?',
      a: 'AES-256 with revision 6 of the PDF standard (the same scheme current Acrobat versions use), applied by qpdf compiled to WebAssembly.',
    },
    {
      q: 'Does my PDF or my password leave my device?',
      a: 'No. The file is read in this tab, encrypted by WebAssembly on your own machine, and the result is handed back to you. Nothing is uploaded and the page makes no network requests.',
    },
    {
      q: 'Can I protect a PDF that is already password-protected?',
      a: 'No. This tool refuses an already-encrypted file instead of quietly re-encrypting it and replacing a password you may still need. Open it with its current password (and remove that protection) first.',
    },
    {
      q: 'Do PDF readers really respect the printing and copying limits?',
      a: 'Mainstream readers honour them, but they are a request to the reader rather than cryptographic protection: anyone who can open the file with the user password can still print the screen. Use them to signal intent, not to make content unextractable.',
    },
  ],
} as const;
