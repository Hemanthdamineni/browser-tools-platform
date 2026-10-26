/**
 * Editorial content for the html-playground tool page.
 *
 * Kept out of ``html-playground.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'The playground gives you three panes — HTML, CSS and JavaScript — and a live preview beside them. Every keystroke schedules a re-render (debounced, so a burst of typing triggers one refresh), and the three parts are stitched into a single document that the preview loads. There is no build step: your CSS lands in a style element and your script in a script element exactly as written.',
    },
    {
      heading: 'How the preview is sandboxed',
      body: 'The iframe is declared with sandbox="allow-scripts" and deliberately without allow-same-origin. That puts the running code in a unique, opaque origin: it can execute and style its own document, but it cannot read this site’s storage, cookies or DOM, and it cannot reach back into the parent page. The preview also sends no referrer.',
    },
    {
      heading: 'Downloading and reusing the result',
      body: 'Download .html assembles the same document you see in the preview into one self-contained file. Your markup goes in the body, your styles in a style block and your behaviour in a script block, with nothing pointing off-page, so the file opens and works on its own — offline, from a USB stick, or in any browser.',
    },
    {
      heading: 'What it does not do',
      body: 'There is no bundler, no transpiler and no framework support: the preview runs the plain HTML, CSS and JavaScript you type. Scripts run after the body has been parsed, so DOM lookups work without a load listener. A closing tag inside a JavaScript string is neutralised so it cannot break out of the template; otherwise CSS and JS are never escaped — the sandbox, not escaping, is the security boundary.',
    },
  ],
  faq: [
    {
      q: 'Can the preview reach this site?',
      a: 'No. The preview runs in an iframe that deliberately omits allow-same-origin, so it sits in a unique, opaque origin. It cannot read this page’s storage, cookies or DOM, and it cannot fetch anything from this domain.',
    },
    {
      q: 'Does anything leave my device?',
      a: 'No. Your HTML, CSS and JS are only ever rendered in the iframe inside this tab. The Download button assembles them into a file on your device; nothing is uploaded or stored.',
    },
    {
      q: 'What is in the downloaded file?',
      a: 'One self-contained .html document. Your HTML goes in the body, your CSS in a <style> tag and your JavaScript in a <script> tag, so the file works on its own with no other assets or references.',
    },
    {
      q: 'My script has </script> in a string — does it break?',
      a: 'No. The template neutralises a closing </script> inside your JavaScript so it cannot break out of the <script> tag and execute outside the document. The document is stitched safely either way.',
    },
  ],
} as const;
