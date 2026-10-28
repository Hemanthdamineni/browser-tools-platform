import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mermaid-renderer',
  name: 'Mermaid Renderer',
  category: 'developer',
  summary: 'Live Mermaid diagram editor with real-time preview and one-click export to SVG or PNG.',
  description:
    'Type or paste Mermaid code (flowchart, sequence diagram, class diagram, state diagram, ER, Gantt, mindmap, quadrant, or any other Mermaid flavour). Watch it render instantly in the browser. Choose a theme, adjust scale, and export a clean SVG (vector) or high-resolution PNG. Everything runs entirely on your device — no uploads, no network, fully offline.',
  keywords: [
    'mermaid',
    'diagram',
    'flowchart',
    'sequence',
    'class diagram',
    'state diagram',
    'er diagram',
    'gantt',
    'mindmap',
    'svg',
    'png',
    'export',
    'render',
    'live editor',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'theme',
      label: 'Theme',
      type: 'select',
      choices: [
        { value: 'default', label: 'Default' },
        { value: 'dark', label: 'Dark' },
        { value: 'forest', label: 'Forest' },
        { value: 'base', label: 'Base' },
        { value: 'neutral', label: 'Neutral' },
        { value: 'ocean', label: 'Ocean' },
      ],
      default: 'default',
    },
    {
      key: 'scale',
      label: 'Zoom / Scale',
      type: 'number',
      default: 1,
      min: 0.5,
      max: 3,
      step: 0.25,
    },
    {
      key: 'showControls',
      label: 'Show zoom & theme controls',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Simple flowchart',
      code: 'graph TD\n    A[Start] --> B{Decision?}\n    B -->|Yes| C[Yes]\n    B -->|No| D[No]\n    C --> E[End]\n    D --> E',
    },
    {
      title: 'Sequence diagram',
      code: 'sequenceDiagram\n    participant Alice\n    participant Bob\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi there!',
    },
    {
      title: 'Class diagram',
      code: 'classDiagram\n    class Animal {\n      +String name\n      +int age\n      +makeSound()\n    }\n    class Dog {\n      +bark()\n    }\n    Dog --|> Animal',
    },
  ],
  faq: [
    {
      q: 'What Mermaid features are supported?',
      a: 'All official Mermaid diagrams: flowcharts (TD, LR, etc.), sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, pie charts, quadrant charts, mindmaps, and more. Custom markdown-style syntax is also supported.',
    },
    {
      q: 'How do I get a clean SVG export?',
      a: 'Click the SVG button. It returns a self-contained SVG string that you can download or embed directly.',
    },
    {
      q: 'Why is the PNG so large?',
      a: 'PNG includes a full raster copy of the diagram at the current scale. You can zoom out or reduce scale for smaller files.',
    },
    {
      q: 'Does it work with offline?',
      a: 'Yes. Once the Mermaid library loads (first time), everything runs in your browser with zero network.',
    },
    {
      q: 'Can I use custom themes?',
      a: 'The built-in themes cover most use cases. For advanced CSS theming, you can still copy the SVG and style it.',
    },
  ],
  related: [  "code-to-image",
  "svg-sanitizer",
  "code-minify"],
  status: 'beta',
};
