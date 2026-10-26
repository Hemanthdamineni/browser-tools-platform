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
  related: ['html-to-jsx', 'html-prettifier', 'code-beautify'],
  status: 'stable',
};
