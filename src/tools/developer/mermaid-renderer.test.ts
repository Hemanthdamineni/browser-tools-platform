import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { detectDiagram, exportBaseName, normaliseSource } from './mermaid-renderer.tool';

type ToolOut = {
  output: string;
  render?: string;
  language?: string;
  filename?: string;
  stats?: Record<string, string | number>;
};

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as ToolOut;

const FLOWCHART = 'flowchart TD\n  A[Start] --> B[Done]';

describe('mermaid-renderer tool', () => {
  it('returns an empty result for empty input', () => {
    expect(run('').output).toBe('');
  });

  it('treats whitespace-only input as empty', () => {
    expect(run('   \n\t\n  ').output).toBe('');
  });

  it('normalises the source and reports the diagram', () => {
    const out = run('flowchart TD  \r\n  A[Start] --> B[Done]\r\n\r\n');
    expect(out.output).toBe(FLOWCHART);
    expect(out.render).toBe('code');
    expect(out.language).toBe('mermaid');
    expect(out.stats).toEqual({ diagram: 'Flowchart', lines: 2, chars: FLOWCHART.length });
    expect(out.filename).toBe('diagram.mmd');
  });

  it('uses the fileName option for the download name', () => {
    expect(run(FLOWCHART, { fileName: 'auth flow' }).filename).toBe('auth flow.mmd');
    expect(run(FLOWCHART, { fileName: 'auth.svg' }).filename).toBe('auth.mmd');
    expect(run(FLOWCHART, { fileName: '   ' }).filename).toBe('diagram.mmd');
  });

  it('throws a friendly ToolError when the input is not a Mermaid diagram', () => {
    expect(() => run('hello world')).toThrow(ToolError);
    expect(() => run('hello world')).toThrow(/not a Mermaid diagram/i);
  });

  it('throws for input that is only comments', () => {
    expect(() => run('%% just a comment')).toThrow(ToolError);
  });

  it('recognises every diagram keyword it claims to', () => {
    const cases: [string, string][] = [
      ['graph LR\n  A --> B', 'flowchart'],
      ['sequenceDiagram\n  A->>B: hi', 'sequence'],
      ['classDiagram\n  class A', 'class'],
      ['stateDiagram-v2\n  [*] --> A', 'state'],
      ['erDiagram\n  A ||--o{ B : has', 'er'],
      ['journey\n  title My day', 'journey'],
      ['gantt\n  title Plan', 'gantt'],
      ['pie\n  "A" : 1', 'pie'],
      ['gitGraph\n  commit', 'gitGraph'],
      ['mindmap\n  root', 'mindmap'],
      ['timeline\n  2020 : event', 'timeline'],
      ['quadrantChart\n  x-axis low --> high', 'quadrant'],
      ['xychart-beta\n  line [1, 2]', 'xychart'],
      ['sankey-beta\n  A,B,1', 'sankey'],
      ['block-beta\n  columns 1', 'block'],
      ['packet-beta\n  0-7: "data"', 'packet'],
      ['requirementDiagram\n  requirement r', 'requirement'],
      ['C4Context\n  Person(a, "A")', 'c4'],
      ['zenuml\n  A.method()', 'zenuml'],
    ];
    for (const [source, type] of cases) {
      expect(detectDiagram(source)?.type, source).toBe(type);
    }
  });

  it('skips YAML frontmatter and comments to find the diagram', () => {
    const source = '---\ntitle: My chart\n---\n%% a comment\nflowchart TD\n  A --> B';
    expect(detectDiagram(source)?.type).toBe('flowchart');
    expect(run(source).stats?.diagram).toBe('Flowchart');
  });

  it('applies the declared defaults when options are omitted', () => {
    const out = tool.run({ text: FLOWCHART }) as ToolOut;
    expect(out.filename).toBe('diagram.mmd');
    expect(out.output).toBe(FLOWCHART);
  });
});

describe('normaliseSource', () => {
  it('unifies line endings and strips trailing whitespace and outer blank lines', () => {
    expect(normaliseSource('\r\nflowchart TD  \r\n\tA --> B\r\n\r\n')).toBe('flowchart TD\n\tA --> B');
  });

  it('keeps interior blank lines', () => {
    expect(normaliseSource('pie\n\n  "A" : 1')).toBe('pie\n\n  "A" : 1');
  });
});

describe('detectDiagram', () => {
  it('returns null for an empty or unrecognised source', () => {
    expect(detectDiagram('')).toBeNull();
    expect(detectDiagram('  \n  ')).toBeNull();
    expect(detectDiagram('%%{init: {}}%%')).toBeNull();
    expect(detectDiagram('not a diagram')).toBeNull();
  });

  it('is case sensitive, like Mermaid', () => {
    expect(detectDiagram('gitgraph\n  commit')).toBeNull();
    expect(detectDiagram('gitGraph\n  commit')?.type).toBe('gitGraph');
  });
});

describe('exportBaseName', () => {
  it('falls back to the default when the option is empty', () => {
    expect(exportBaseName('')).toBe('diagram');
    expect(exportBaseName(undefined)).toBe('diagram');
    expect(exportBaseName('   ')).toBe('diagram');
  });

  it('strips a known extension the user typed', () => {
    expect(exportBaseName('my chart.svg')).toBe('my chart');
    expect(exportBaseName('flow.png')).toBe('flow');
    expect(exportBaseName('graph.mermaid')).toBe('graph');
  });

  it('keeps a plain name as-is', () => {
    expect(exportBaseName('auth flow')).toBe('auth flow');
  });
});
