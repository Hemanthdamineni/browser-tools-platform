/**
 * Mermaid Renderer — the standalone registry entry point.
 *
 * The live editor lives in the dedicated `mermaid-renderer` panel: a source
 * textarea next to a sandboxed iframe showing the SVG, with Mermaid doing the
 * parsing, the rendering and the error reporting in the browser. This `run()`
 * is the pure path that powers the tool contract — and stays free of Mermaid
 * itself, because Mermaid's parser reaches for the DOM (its text sanitiser
 * needs `document`), which a pure `run()` may not do.
 *
 * What it does is the part that *can* be pure and is still useful: normalise
 * the source (line endings, trailing whitespace) and identify the diagram from
 * its opening keyword, so a caller gets a cleaned, download-ready `.mmd` with
 * the diagram kind named. Anything that cannot be recognised is refused with a
 * friendly `ToolError` rather than passed through silently. The panel calls
 * this `run()` before every render (through `runToolById`), so the friendly
 * "that is not a diagram" case is decided here and the `.svg` / `.png` exports
 * reuse `exportBaseName` for the same file name.
 */
import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mermaid-renderer.meta';

/** The file name used when the `fileName` option is left empty. */
export const DEFAULT_EXPORT_BASE = 'diagram';

/**
 * The base name of the exported files, from the `fileName` option. A known
 * extension in the option value is stripped (each caller supplies its own), and
 * an empty value falls back to `diagram`. Shared by the tool's `.mmd` name and
 * the panel's `.svg` / `.png` downloads, so all three always match.
 */
export function exportBaseName(value: unknown): string {
  const name = String(value ?? '')
    .trim()
    .replace(/\.(mmd|mermaid|svg|png)$/i, '')
    .trim();
  return name || DEFAULT_EXPORT_BASE;
}

/** A diagram Mermaid can render, matched on the opening keyword of the source. */
export interface DiagramKind {
  type: string;
  label: string;
}

/**
 * The Mermaid diagram keywords, in match order. The patterns are anchored and
 * case-sensitive because Mermaid's own keywords are (`gitGraph` is not
 * `gitgraph`), and beta-only diagrams keep their suffix optional so both the
 * short and the `-beta` spelling are recognised.
 */
const DIAGRAMS: { readonly pattern: RegExp; readonly kind: DiagramKind }[] = [
  { pattern: /^flowchart\b/, kind: { type: 'flowchart', label: 'Flowchart' } },
  { pattern: /^graph\b/, kind: { type: 'flowchart', label: 'Flowchart' } },
  { pattern: /^sequenceDiagram\b/, kind: { type: 'sequence', label: 'Sequence diagram' } },
  { pattern: /^classDiagram\b/, kind: { type: 'class', label: 'Class diagram' } },
  { pattern: /^stateDiagram\b/, kind: { type: 'state', label: 'State diagram' } },
  { pattern: /^erDiagram\b/, kind: { type: 'er', label: 'Entity relationship diagram' } },
  { pattern: /^journey\b/, kind: { type: 'journey', label: 'User journey' } },
  { pattern: /^gantt\b/, kind: { type: 'gantt', label: 'Gantt chart' } },
  { pattern: /^pie\b/, kind: { type: 'pie', label: 'Pie chart' } },
  { pattern: /^gitGraph\b/, kind: { type: 'gitGraph', label: 'Git graph' } },
  { pattern: /^mindmap\b/, kind: { type: 'mindmap', label: 'Mind map' } },
  { pattern: /^timeline\b/, kind: { type: 'timeline', label: 'Timeline' } },
  { pattern: /^quadrantChart\b/, kind: { type: 'quadrant', label: 'Quadrant chart' } },
  { pattern: /^xychart(-beta)?\b/, kind: { type: 'xychart', label: 'XY chart' } },
  { pattern: /^sankey(-beta)?\b/, kind: { type: 'sankey', label: 'Sankey diagram' } },
  { pattern: /^block(-beta)?\b/, kind: { type: 'block', label: 'Block diagram' } },
  { pattern: /^packet(-beta)?\b/, kind: { type: 'packet', label: 'Packet diagram' } },
  { pattern: /^requirementDiagram\b/, kind: { type: 'requirement', label: 'Requirement diagram' } },
  {
    pattern: /^C4(Context|Container|Component|Dynamic|Deployment)\b/,
    kind: { type: 'c4', label: 'C4 diagram' },
  },
  { pattern: /^zenuml\b/, kind: { type: 'zenuml', label: 'ZenUML' } },
];

/**
 * Clean the source up for reuse: line endings unified to `\n`, trailing
 * whitespace removed from every line, and blank lines trimmed from the start
 * and the end. Interior blank lines are kept — they are part of the diagram.
 */
export function normaliseSource(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/**
 * The first line that carries the diagram: the YAML frontmatter block (when
 * present) and any `%%` comments are skipped. `''` when there is no such line.
 */
function firstSignificantLine(source: string): string {
  const lines = source.split('\n');
  let index = 0;

  // A leading `---` opens YAML frontmatter; skip through its closing marker.
  if ((lines[0] ?? '').trim() === '---') {
    index = 1;
    while (index < lines.length && (lines[index] ?? '').trim() !== '---') index++;
    if (index < lines.length) index++;
  }

  for (; index < lines.length; index++) {
    const line = (lines[index] ?? '').trim();
    if (!line || line.startsWith('%%')) continue;
    return line;
  }
  return '';
}

/** The diagram the source opens with, or `null` when it is not a Mermaid one. */
export function detectDiagram(source: string): DiagramKind | null {
  const line = firstSignificantLine(source);
  if (!line) return null;
  for (const { pattern, kind } of DIAGRAMS) {
    if (pattern.test(line)) return kind;
  }
  return null;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text?.trim()) return { output: '' };

  const source = normaliseSource(input.text);
  const diagram = detectDiagram(source);
  if (!diagram) {
    throw new ToolError(
      'That is not a Mermaid diagram.',
      'Open with a diagram keyword such as flowchart, sequenceDiagram, classDiagram, erDiagram or gantt.',
    );
  }

  return {
    output: source,
    render: 'code',
    language: 'mermaid',
    filename: `${exportBaseName(o.fileName)}.mmd`,
    stats: { diagram: diagram.label, lines: source.split('\n').length, chars: source.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;