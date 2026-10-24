import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-playground',
  name: 'HTML Playground',
  category: 'developer',
  summary:
    'Three panes for HTML, CSS and JS with a sandboxed live preview as you type, plus a one-click .html download.',
  description:
    'A three-pane editor for HTML, CSS and JavaScript with a live preview that re-renders as you type. The preview runs in a sandboxed iframe without same-origin access, so your code can never touch this site — and the Download button stitches the three parts into a single, self-contained .html file. Everything happens in this tab.',
  keywords: [
    'html',
    'css',
    'javascript',
    'js',
    'live preview',
    'sandbox',
    'iframe',
    'playground',
    'codepen',
    'jsfiddle',
    'html editor',
    'web snippet',
    'export html',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'html-playground',
  options: [
    {
      key: 'fileName',
      label: 'Download file name',
      type: 'text',
      default: '',
      placeholder: 'playground.html',
      help: 'Leave empty to use playground.html.',
    },
  ],
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
  examples: [
    {
      title: 'Hello world',
      input: JSON.stringify({
        html: '<h1 id="greeting">Hello, world!</h1>\n<p>Edit the panes and watch the preview update.</p>',
        css: 'body { font-family: system-ui, sans-serif; padding: 2rem; }\nh1 { color: #2563eb; }',
        js: 'document.querySelector("#greeting").addEventListener("click", () => {\n  alert("You clicked the heading.");\n});',
      }),
    },
    {
      title: 'Button counter',
      input: JSON.stringify({
        html: '<button id="btn">Count: 0</button>',
        css: 'button { font-size: 1.5rem; padding: 0.5rem 1rem; }',
        js: 'let n = 0;\ndocument.querySelector("#btn").addEventListener("click", () => {\n  n += 1;\n  document.querySelector("#btn").textContent = `Count: ${n}`;\n});',
      }),
    },
    {
      title: 'CSS animation',
      input: JSON.stringify({
        html: '<div class="ball"></div>',
        css: '@keyframes bounce {\n  from { transform: translateY(0); }\n  to { transform: translateY(-40px); }\n}\n.ball {\n  width: 80px; height: 80px;\n  border-radius: 50%;\n  background: #f59e0b;\n  animation: bounce 0.6s ease-in-out infinite alternate;\n}',
        js: '',
      }),
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
  related: ['html-to-jsx', 'html-prettifier', 'code-beautify'],
  status: 'stable',
};
