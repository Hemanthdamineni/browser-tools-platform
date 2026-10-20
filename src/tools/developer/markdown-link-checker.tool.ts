import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './markdown-link-checker.meta';

interface Issue {
  severity: string;
  kind: string;
  label: string;
  target: string;
  line: number;
}

const CUSTOM_ANCHOR = /\s+\{#([^}]*)\}\s*$/;
const EMPTY_ANCHOR = /^\s*$/;

function gitHubSlug(text: string): string {
  const custom = text.match(CUSTOM_ANCHOR);
  if (custom) return custom[1]!.replace(/[^\w-]/g, '').toLowerCase() || 'section';
  return text
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function headingAnchor(line: string): { anchor: string; custom: boolean } | null {
  const atx = line.match(/^(#{1,6})\s+(.+)$/);
  if (!atx) return null;
  const heading = atx[2]!;
  const custom = CUSTOM_ANCHOR.test(heading);
  return { anchor: gitHubSlug(heading), custom };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const checkExternal = o.checkExternal !== false;
  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError(
      'Paste a Markdown document to check.',
      'Links and headings are scanned on-device.',
    );
  }
  if (text.length > 250_000) {
    throw new ToolError('Document is too large.', 'Keep it under 250,000 characters.');
  }

  const lines = text.split('\n');
  const headingAnchors = new Map<string, number[]>();
  const headingLines: number[] = [];
  const customAnchors = new Map<string, number>();

  // Pass 1: headings and custom anchors (also track duplicates).
  for (let i = 0; i < lines.length; i++) {
    const ha = headingAnchor(lines[i]!);
    if (ha) {
      const list = headingAnchors.get(ha.anchor);
      if (list) list.push(i + 1);
      else headingAnchors.set(ha.anchor, [i + 1]);
      headingLines.push(i + 1);
      if (ha.custom) customAnchors.set(ha.anchor, i + 1);
    }
  }

  const issues: Issue[] = [];

  // Pass 2: reference definitions and inline links, skipping fenced and indented code.
  const definitions = new Map<string, { url: string; line: number }>();
  const usedRefs = new Set<string>();
  let stats = { links: 0, internal: 0, external: 0, broken: 0 };

  // Pass 2a: collect reference definitions first so forward references resolve.
  {
    let inDefFence: string | null = null;
    for (let i = 0; i < lines.length; i++) {
      const t0 = lines[i]!.trim();
      if (inDefFence) {
        if (t0.startsWith(inDefFence)) inDefFence = null;
        continue;
      }
      if (/^```|^~~~/.test(t0)) {
        inDefFence = t0.startsWith('```') ? '```' : '~~~';
        continue;
      }
      if (/^ {4}/.test(lines[i]!) || /^\t/.test(lines[i]!)) continue;
      const dm = t0.match(/^\[([^\]]+)\]:\s*(\S+)\s*$/);
      if (dm) {
        definitions.set(dm[1]!.toLowerCase(), { url: dm[2]!, line: i + 1 });
      }
    }
  }

  let inFence: string | null = null;

  const classify = (
    label: string,
    target: string,
    line: number,
    isImage: boolean,
    raw: string,
  ): void => {
    stats.links += 1;
    const t = target.trim();
    const lbl = label.trim() || (isImage ? '(image)' : '(empty)');
    if (!t) {
      issues.push({ severity: 'error', kind: 'empty-url', label: lbl, target: '', line });
      stats.broken += 1;
      return;
    }
    if (/^(https?:|mailto:|ftp:|tel:)/i.test(t)) {
      stats.external += 1;
      if (checkExternal) {
        issues.push({ severity: 'info', kind: 'external', label: lbl, target: t, line });
      }
      return;
    }
    if (t.startsWith('#')) {
      const anchor = t.slice(1);
      if (EMPTY_ANCHOR.test(anchor)) {
        issues.push({ severity: 'error', kind: 'empty-anchor', label: lbl, target: t, line });
        stats.broken += 1;
        return;
      }
      stats.internal += 1;
      if (!headingAnchors.has(anchor) && !customAnchors.has(anchor)) {
        issues.push({ severity: 'error', kind: 'broken-fragment', label: lbl, target: t, line });
        stats.broken += 1;
        return;
      }
      issues.push({ severity: 'ok', kind: 'ok', label: lbl, target: t, line });
      return;
    }
    // Local file or unknown scheme: flag as info.
    issues.push({ severity: 'info', kind: 'local', label: lbl, target: t, line });
    void raw;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]!;
    const trimmed = lineText.trim();

    // Fence handling.
    if (inFence) {
      if (trimmed.startsWith(inFence)) inFence = null;
      continue;
    }
    if (/^```|^~~~/.test(trimmed)) {
      inFence = trimmed.startsWith('```') ? '```' : '~~~';
      continue;
    }
    // Indented code block (4 spaces) — skip.
    if (/^ {4}/.test(lineText) || /^\t/.test(lineText)) continue;

    // Reference definitions: [name]: url
    const def = trimmed.match(/^\[([^\]]+)\]:\s*(\S+)\s*$/);
    if (def) {
      definitions.set(def[1]!.toLowerCase(), { url: def[2]!, line: i + 1 });
      continue;
    }

    // Inline links: [label](url) and images ![alt](url)
    const inlineRe = /!?\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g;
    let m: RegExpExecArray | null;
    inlineRe.lastIndex = 0;
    while ((m = inlineRe.exec(lineText)) !== null) {
      const isImage = m[0].startsWith('!');
      classify(m[1] ?? '', m[2] ?? '', i + 1, isImage, m[0]);
    }

    // Reference links: [label][ref]
    const refRe = /!?\[([^\]]*)\]\[([^\]]*)\]/g;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(lineText)) !== null) {
      const refName = (m[2] ?? '').trim();
      if (!refName) continue;
      usedRefs.add(refName.toLowerCase());
      stats.links += 1;
      if (!definitions.has(refName.toLowerCase())) {
        issues.push({
          severity: 'error',
          kind: 'missing-definition',
          label: m[1] ?? '',
          target: `[${refName}]`,
          line: i + 1,
        });
        stats.broken += 1;
      }
    }
  }

  // Unused definitions.
  for (const [name, info] of definitions) {
    if (!usedRefs.has(name)) {
      issues.push({
        severity: 'warning',
        kind: 'unused-definition',
        label: `[${name}]:`,
        target: info.url,
        line: info.line,
      });
    }
  }

  // Duplicate heading anchors flagged as warnings.
  for (const [anchor, lns] of headingAnchors) {
    if (lns.length > 1) {
      issues.push({
        severity: 'warning',
        kind: 'duplicate-anchor',
        label: anchor,
        target: `lines ${lns.join(', ')}`,
        line: lns[0]!,
      });
    }
  }

  const tableRows = issues.map((x) => [x.severity, x.kind, x.label, x.target, String(x.line)]);

  return {
    output: JSON.stringify({
      headers: ['Status', 'Kind', 'Label', 'Target', 'Line'],
      rows: tableRows,
    }),
    render: 'table',
    stats: { ...stats, headings: headingLines.length, issues: issues.length },
    notes: [
      `${stats.links} link${stats.links === 1 ? '' : 's'} scanned, ${stats.broken} broken.`,
      'External links are reported but never fetched (on-device).',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
