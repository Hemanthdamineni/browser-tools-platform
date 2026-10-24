import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mermaid-renderer',
  name: 'Mermaid Renderer',
  category: 'developer',
  summary:
    'Edit Mermaid diagram source and watch a live SVG render, then export the SVG or a PNG.',
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
  article: [
    {
      heading: 'Edit and render as you type',
      body: 'Type Mermaid source on the left and the diagram redraws on the right as you go. Keystrokes are debounced, so a burst of typing becomes a single render instead of one per character. Syntax errors appear inline with the line Mermaid stopped on, and the last good diagram stays on screen until you fix it.',
    },
    {
      heading: 'Which diagrams it renders',
      body: 'Anything Mermaid itself understands: flowcharts and graphs, sequence diagrams, class and state diagrams, entity relationship diagrams, Gantt charts, pie and quadrant charts, mind maps, timelines, git graphs, user journeys, requirement diagrams, sankey, block and packet diagrams, XY charts, C4 diagrams and ZenUML. The diagram kind is read from the opening keyword of your source.',
    },
    {
      heading: 'How the SVG is prepared',
      body: 'Rendering happens entirely in this tab. The SVG is rewritten into a self-contained file: the namespace declarations are guaranteed and a viewBox is always present, so the diagram has a real pixel size instead of a percentage width. The preview loads that markup in a sandboxed iframe with no scripts and no same-origin access, and blocks every remote request — a diagram can never fetch anything or reach this page.',
    },
    {
      heading: 'Exporting the result',
      body: 'Export SVG saves the vector file, which stays sharp at any size and edits in any vector tool. Export PNG rasterises the same SVG on a canvas at one to eight pixels per SVG pixel — raise the scale for retina screens or print, lower it for a small file. Both downloads use the file name you set, and the theme option re-renders with the matching Mermaid palette.',
    },
  ],
  examples: [
    { title: 'Flowchart', input: 'flowchart TD\n  A[Start] --> B{Is it working?}\n  B -- Yes --> C[Great!]\n  B -- No --> D[Fix it]\n  D --> B' },
    { title: 'Sequence', input: 'sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice->>John: Hello John, how are you?\n  loop Healthcheck\n    John->>John: Fight against hypochondria\n  end\n  Note right of John: Rational thoughts prevail!\n  John-->>Alice: Great!\n  John->>Bob: How about you?\n  Bob-->>John: Jolly good!' },
    { title: 'Gantt', input: 'gantt\n  title A Gantt Diagram\n  dateFormat YYYY-MM-DD\n  section Section\n    A task :a1, 2023-01-01, 30d\n    Another task :after a1, 20d\n  section Another\n    Task in sec :2023-01-12, 12d\n    another task :24d' },
  ],
  faq: [
    {
      q: 'Does the editor send my diagram anywhere?',
      a: 'No. Mermaid runs entirely in your browser and nothing is uploaded — the SVG and PNG exports are generated locally in this tab.',
    },
    {
      q: 'Why does my diagram show a syntax error?',
      a: 'The editor validates the Mermaid source and shows the first problem inline under the editor. Fix the marked line and the render updates automatically.',
    },
    {
      q: 'What is the difference between SVG and PNG export?',
      a: 'SVG is a crisp, infinitely scalable vector format. PNG is a raster image rendered from the same SVG on a canvas, so it is best for sharing where vector files are not supported.',
    },
  ],
  related: ['svg-to-jsx', 'html-to-markdown', 'csv-profiler', 'json-format'],
  credits: [{ name: 'mermaid', url: 'https://github.com/mermaid-js/mermaid', license: 'MIT' }],
  status: 'stable',
};