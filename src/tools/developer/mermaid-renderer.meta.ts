import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mermaid-renderer',
  name: 'Mermaid Renderer',
  category: 'developer',
  summary: 'Edit Mermaid diagram source and watch a live SVG render, then export the SVG or a PNG.',
  description:
    'A live Mermaid editor: type a Mermaid diagram on the left and the SVG render updates on the right as you type, with syntax errors shown inline. Switch between light and dark themes, zoom the preview, and export the finished diagram as an SVG or as a raster PNG. Everything runs in this tab — your diagram never leaves the browser.',
  keywords: [
    'mermaid',
    'diagram',
    'flowchart',
    'sequence diagram',
    'gantt',
    'er diagram',
    'class diagram',
    'state diagram',
    'pie chart',
    'svg',
    'png',
    'live preview',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'mermaid-renderer',
  options: [
    {
      key: 'theme',
      label: 'Theme',
      type: 'select',
      default: 'light',
      choices: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
    },
    {
      key: 'pngScale',
      label: 'PNG export scale',
      type: 'number',
      default: 2,
      min: 1,
      max: 8,
      step: 1,
      help: 'How many PNG pixels per SVG pixel when exporting. Higher = sharper, larger file.',
    },
    {
      key: 'fileName',
      label: 'Export file name',
      type: 'text',
      default: '',
      placeholder: 'diagram',
      help: 'Base name for the exported .svg and .png. Leave empty to use diagram.',
    },
  ],
  examples: [
    {
      title: 'Flowchart',
      input:
        'flowchart TD\n  A[Start] --> B{Is it working?}\n  B -- Yes --> C[Great!]\n  B -- No --> D[Fix it]\n  D --> B',
    },
    {
      title: 'Sequence',
      input:
        'sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice->>John: Hello John, how are you?\n  loop Healthcheck\n    John->>John: Fight against hypochondria\n  end\n  Note right of John: Rational thoughts prevail!\n  John-->>Alice: Great!\n  John->>Bob: How about you?\n  Bob-->>John: Jolly good!',
    },
    {
      title: 'Gantt',
      input:
        'gantt\n  title A Gantt Diagram\n  dateFormat YYYY-MM-DD\n  section Section\n    A task :a1, 2023-01-01, 30d\n    Another task :after a1, 20d\n  section Another\n    Task in sec :2023-01-12, 12d\n    another task :24d',
    },
  ],
  related: ['svg-to-jsx', 'html-to-markdown', 'csv-profiler', 'json-format'],
  credits: [{ name: 'mermaid', url: 'https://github.com/mermaid-js/mermaid', license: 'MIT' }],
  status: 'stable',
};
