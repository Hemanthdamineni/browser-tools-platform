import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './srcset-inspector.meta';

/**
 * srcset / sizes inspector.
 *
 * Implements the WHATWG HTML "parse a srcset attribute" and "parse a sizes
 * attribute" algorithms. The expected candidate lists in the tests come from
 * the worked examples in that specification, not from this parser.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CANDIDATES = 5000;

type Severity = 'error' | 'warn' | 'info';

interface Finding {
  severity: Severity;
  kind: string;
  detail: string;
}

interface Candidate {
  url: string;
  /** Width in CSS pixels when a width descriptor was used. */
  width: number | null;
  /** Density when a density descriptor was used, or implied for a width. */
  density: number | null;
  descriptor: string;
  /** Effective density, width / sourceSize when a width descriptor was used. */
  effective: number | null;
}

interface Model {
  candidates: Candidate[];
  findings: Finding[];
  sizes: string;
  sourceSize: number | null;
  viewport: number;
  dpr: number;
  selectedIndex: number | null;
}
const SPACE = ' \t\n\r\f';

function isSpaceChar(c: string): boolean {
  return SPACE.includes(c);
}

function parseSrcset(input: string): { candidates: Candidate[]; findings: Finding[] } {
  const candidates: Candidate[] = [];
  const findings: Finding[] = [];
  const s = input;
  let pos = 0;

  const report = (kind: string, detail: string): void => {
    findings.push({ severity: 'error', kind, detail });
  };

  while (pos < s.length) {
    while (pos < s.length && (isSpaceChar(s[pos]!) || s[pos] === ',')) pos += 1;
    if (pos >= s.length) break;
    const urlStartPos = pos;
    while (pos < s.length && !isSpaceChar(s[pos]!) && s[pos] !== ',') pos += 1;
    let url = s.slice(urlStartPos, pos);
    if (url.endsWith(',')) {
      const trimmed = url.replace(/,+$/u, '');
      const removedCount = url.length - trimmed.length;
      url = trimmed;
      pos -= removedCount - 1;
    }
    if (url === '') continue;
    const descStartPos = pos;
    let depth = 0;
    while (pos < s.length) {
      const c = s[pos]!;
      if (c === '(') depth += 1;
      else if (c === ')') depth = Math.max(0, depth - 1);
      else if (c === ',' && depth === 0) break;
      pos += 1;
    }
    const descText = s.slice(descStartPos, pos);
    let width: number | null = null;
    let density: number | null = null;
    let invalid = false;

    const tokens = descText
      .split(/[\t\n\r\f ()]+/u)
      .map((t) => t.trim().replace(/^,+|,+$/gu, ''))
      .filter((t) => t !== '');
    for (const token of tokens) {
      if (/^\d+w$/iu.test(token)) {
        const value = Number(token.slice(0, -1));
        if (!Number.isInteger(value) || value <= 0) {
          report('invalid-width', `Width descriptor "${token}" on "${url}" must be a positive integer.`);
          invalid = true;
        } else if (width !== null) {
          report('duplicate-width', `"${url}" has more than one width descriptor.`);
          invalid = true;
        } else if (density !== null) {
          report('mixed-descriptors', `"${url}" mixes a width and a density descriptor.`);
          invalid = true;
        } else {
          width = value;
        }
      } else if (/^(\d+(\.\d+)?|\.\d+)x$/iu.test(token)) {
        const value = Number.parseFloat(token.slice(0, -1));
        if (!Number.isFinite(value) || value <= 0) {
          report('invalid-density', `Density descriptor "${token}" on "${url}" must be greater than zero.`);
          invalid = true;
        } else if (density !== null) {
          report('duplicate-density', `"${url}" has more than one density descriptor.`);
          invalid = true;
        } else if (width !== null) {
          report('mixed-descriptors', `"${url}" mixes a density and a width descriptor.`);
          invalid = true;
        } else {
          density = value;
        }
      } else {
        report('unknown-descriptor', `Unrecognised descriptor "${token}" on "${url}".`);
        invalid = true;
      }
    }
    if (width === null && density === null && !invalid) density = 1;
    candidates.push({ url, width, density, descriptor: descText, effective: null });
    if (candidates.length > MAX_CANDIDATES) {
      report('too-many', `More than ${MAX_CANDIDATES} candidates; parsing stopped.`);
      break;
    }
    if (pos < s.length && s[pos] === ',') pos += 1;
  }
  return { candidates, findings };
}

/**
 * Split a sizes value into "(media) length" pairs plus an optional bare length.
 * Media conditions contain no commas here per the HTML grammar, so a
 * top-level comma split is safe once parentheses are balanced.
 */
function splitSizesList(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const c of value) {
    if (c === '(') depth += 1;
    else if (c === ')') depth = Math.max(0, depth - 1);
    if (c === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  const rest = current.trim();
  if (rest !== '') parts.push(rest);
  return parts;
}

type SizesEntry =
  | { kind: 'media'; condition: string; length: string }
  | { kind: 'bare'; length: string };

function parseSizesList(value: string): { entries: SizesEntry[]; findings: Finding[] } {
  const entries: SizesEntry[] = [];
  const findings: Finding[] = [];
  let bareCount = 0;

  for (const rawPart of splitSizesList(value)) {
    if (rawPart === '') continue;
    const part = rawPart;
    if (part.startsWith('(')) {
      let depth = 0;
      let close = -1;
      for (let i = 0; i < part.length; i += 1) {
        if (part[i] === '(') depth += 1;
        else if (part[i] === ')') {
          depth -= 1;
          if (depth === 0) {
            close = i;
            break;
          }
        }
      }
      if (close < 0) {
        findings.push({
          severity: 'error',
          kind: 'sizes-unbalanced',
          detail: `Unbalanced media condition "${part}".`,
        });
        continue;
      }
      const condition = part.slice(0, close + 1);
      const length = part.slice(close + 1).trim();
      if (length === '') {
        findings.push({
          severity: 'error',
          kind: 'sizes-missing-length',
          detail: `Media condition "${condition}" has no length.`,
        });
        continue;
      }
      entries.push({ kind: 'media', condition, length });
    } else {
      entries.push({ kind: 'bare', length: part });
      bareCount += 1;
      if (bareCount > 1) {
        findings.push({
          severity: 'warn',
          kind: 'sizes-multiple-bare',
          detail: `Only the last bare length "${part}" is used; earlier bare lengths are unreachable.`,
        });
      }
    }
  }
  return { entries, findings };
}

function parsePx(token: string, viewport: number): number | null {
  const m = /^([\d.]+)(px|em|rem|vw|vh)?$/u.exec(token);
  if (m === null) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] ?? 'px';
  if (unit === 'px') return n;
  if (unit === 'rem' || unit === 'em') return n * 16;
  if (unit === 'vw') return (n * viewport) / 100;
  return null;
}

function evalMediaCondition(
  condition: string,
  viewport: number,
): { matches: boolean; supported: boolean } {
  const raw = condition.trim();
  const inner = raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1).trim() : raw;
  const lower = inner.toLowerCase();

  const colon = lower.split(':');
  if (colon.length === 2) {
    const feature = colon[0]!.trim();
    const value = parsePx(colon[1]!.trim(), viewport);
    if (value === null) return { matches: false, supported: false };
    if (feature === 'min-width') return { matches: viewport >= value, supported: true };
    if (feature === 'max-width') return { matches: viewport <= value, supported: true };
    if (feature === 'width') return { matches: viewport === value, supported: true };
    return { matches: false, supported: false };
  }

  const cmp = /^width\s*(>=|<=|>|<)\s*([\d.]+[a-z]*)$/u.exec(lower);
  if (cmp === null) return { matches: false, supported: false };
  const value = parsePx(cmp[2]!, viewport);
  if (value === null) return { matches: false, supported: false };
  const op = cmp[1];
  if (op === '>=') return { matches: viewport >= value, supported: true };
  if (op === '<=') return { matches: viewport <= value, supported: true };
  if (op === '>') return { matches: viewport > value, supported: true };
  return { matches: viewport < value, supported: true };
}

/** Compute effective density for every candidate given a source size. */
function computeDensities(
  candidates: Candidate[],
  sourceSize: number,
  viewport: number,
): Finding[] {
  const findings: Finding[] = [];
  // The "sizes" default when absent is 100vw, i.e. the full viewport width.
  const size = sourceSize > 0 ? sourceSize : viewport;
  if (size <= 0) {
    findings.push({
      severity: 'error',
      kind: 'zero-source-size',
      detail: 'Source size resolves to zero, so densities cannot be computed.',
    });
    return findings;
  }
  for (const candidate of candidates) {
    if (candidate.width !== null) {
      candidate.effective = candidate.width / size;
    } else if (candidate.density !== null) {
      candidate.effective = candidate.density;
    }
  }
  return findings;
}

/** Choose the candidate a user agent would pick for the given DPR. */
function selectCandidate(candidates: Candidate[], dpr: number): number | null {
  const usable: { index: number; density: number }[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i]!;
    const density = c.effective ?? c.density ?? 1;
    if (density > 0) usable.push({ index: i, density });
  }
  if (usable.length === 0) return null;

  // WHATWG "select an image source": choose the greatest density that does not
  // exceed dpr; if every density exceeds dpr, choose the smallest density.
  usable.sort((a, b) => a.density - b.density);
  let bestIndex: number | null = null;
  let bestDensity = 0;
  for (const entry of usable) {
    if (entry.density <= dpr && entry.density > bestDensity) {
      bestDensity = entry.density;
      bestIndex = entry.index;
    }
  }
  if (bestIndex === null) bestIndex = usable[0]!.index;
  return bestIndex;
}

function describeCandidate(c: Candidate): string {
  if (c.width !== null) return `${c.width}w`;
  return `${c.density ?? 1}x`;
}

function tableCandidates(model: Model): { headers: string[]; rows: string[][] } {
  const headers = ['URL', 'Descriptor', 'Width', 'Density', 'Effective'];
  const rows: string[][] = [];
  for (let i = 0; i < model.candidates.length; i += 1) {
    const c = model.candidates[i]!;
    rows.push([
      c.url,
      c.descriptor === '' ? '(none)' : c.descriptor,
      c.width === null ? '' : String(c.width),
      c.density === null ? '' : String(c.density),
      c.effective === null ? '' : c.effective.toFixed(3),
    ]);
  }
  return { headers, rows };
}
function buildFindings(candidates: Candidate[], text: string): Finding[] {
  const findings: Finding[] = [];
  if (text.trim() === '') {
    findings.push({
      severity: 'error',
      kind: 'empty-srcset',
      detail: 'srcset is empty, so no candidate is available.',
    });
    return findings;
  }
  if (candidates.length === 0) {
    findings.push({
      severity: 'error',
      kind: 'no-candidates',
      detail: 'No usable candidate URL was found.',
    });
  }
  const hasWidth = candidates.some((c) => c.width !== null);
  const hasDensity = candidates.some((c) => c.width === null);
  if (hasWidth && hasDensity) {
    findings.push({
      severity: 'error',
      kind: 'mixed-candidate-types',
      detail: 'Candidates mix width and density descriptors; a srcset must use one kind or the other.',
    });
  }
  return findings;
}

const num = (v: string | number | boolean | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Resolve the sizes list to a source size in CSS px for a viewport width. */
function resolveSourceSize(
  sizes: string,
  viewport: number,
): { size: number; findings: Finding[]; usedIndex: number | null } {
  const trimmed = sizes.trim();
  if (trimmed === '') return { size: viewport, findings: [], usedIndex: null };
  const { entries, findings } = parseSizesList(trimmed);

  let bareIndex: number | null = null;
  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i]!.kind === 'bare') bareIndex = i;
  }
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry === undefined || entry.kind !== 'media') continue;
    const verdict = evalMediaCondition(entry.condition, viewport);
    if (!verdict.supported) {
      findings.push({
        severity: 'warn',
        kind: 'sizes-unsupported-condition',
        detail: `Cannot evaluate media condition "${entry.condition}" for a ${viewport}px viewport.`,
      });
      continue;
    }
    if (verdict.matches) {
      const px = parsePx(entry.length, viewport);
      if (px === null) {
        findings.push({
          severity: 'error',
          kind: 'sizes-invalid-length',
          detail: `Cannot resolve length "${entry.length}".`,
        });
        continue;
      }
      return { size: px, findings, usedIndex: i };
    }
  }

  if (bareIndex === null) {
    findings.push({
      severity: 'warn',
      kind: 'sizes-no-default',
      detail: 'No bare length and no matching condition; falling back to 100vw.',
    });
    return { size: viewport, findings, usedIndex: null };
  }
  const bare = entries[bareIndex]!;
  const px = parsePx(bare.length, viewport);
  if (px === null) {
    findings.push({ severity: 'error', kind: 'sizes-invalid-length', detail: `Cannot resolve length "${bare.length}".` });
    return { size: viewport, findings, usedIndex: null };
  }
  return { size: px, findings, usedIndex: bareIndex };
}
function buildModel(
  text: string,
  options: Record<string, string | number | boolean | undefined>,
): Model {
  const sizes = typeof options.sizes === 'string' ? options.sizes : '';
  const viewport = num(options.viewport, 1280);
  const dpr = num(options.dpr, 1);
  const { candidates, findings: parseFindings } = parseSrcset(text);
  const findings = parseFindings.slice();
  findings.push(...buildFindings(candidates, text));

  const hasWidth = candidates.some((c) => c.width !== null);
  let sourceSize: number | null = null;
  if (hasWidth) {
    const resolved = resolveSourceSize(sizes, viewport);
    findings.push(...resolved.findings);
    sourceSize = resolved.size;
    findings.push(...computeDensities(candidates, sourceSize, viewport));
  } else {
    for (const candidate of candidates) {
      if (candidate.density !== null) candidate.effective = candidate.density;
    }
  }

  const selectedIndex = selectCandidate(candidates, dpr);
  return { candidates, findings, sizes, sourceSize, viewport, dpr, selectedIndex };
}

function tableFindings(model: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Severity', 'Kind', 'Detail'];
  const rows: string[][] = [];
  for (const f of model.findings) rows.push([f.severity, f.kind, f.detail]);
  if (rows.length === 0) rows.push(['info', 'ok', 'No findings.']);
  return { headers, rows };
}

function summaryReport(model: Model): string {
  const errors = model.findings.filter((f) => f.severity === 'error').length;
  const warns = model.findings.filter((f) => f.severity === 'warn').length;
  const selected =
    model.selectedIndex === null ? '(none)' : describeCandidate(model.candidates[model.selectedIndex]!);
  const lines = [
    `Candidates: ${model.candidates.length}`,
    `Errors: ${errors}`,
    `Warnings: ${warns}`,
    `sizes: ${model.sizes.trim() === '' ? '(absent, treated as 100vw)' : model.sizes}`,
    `Viewport: ${model.viewport}px`,
    `Device pixel ratio: ${model.dpr}`,
  ];
  if (model.sourceSize !== null) lines.push(`Source size: ${model.sourceSize.toFixed(2)}px`);
  lines.push(`Selected: ${selected}`);
  return lines.join('\n');
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    let text = input.text ?? '';
    if (file !== undefined) {
      if (file.size > MAX_BYTES) throw new ToolError(`File is larger than ${MAX_BYTES} bytes.`, 'Provide a smaller srcset snippet.');
      text = await file.text();
    }
    const model = buildModel(text, options);
    const view = String(options.format ?? 'summary');

    let report: FileRunResult['report'];
    if (view === 'candidates') {
      const table = tableCandidates(model);
      report = { output: JSON.stringify(table), render: 'table' };
    } else if (view === 'findings') {
      const table = tableFindings(model);
      report = { output: JSON.stringify(table), render: 'table' };
    } else if (view === 'selected') {
      const idx = model.selectedIndex;
      const output =
        idx === null
          ? 'No candidate could be selected.'
          : `Selected ${model.candidates[idx]!.url} (${describeCandidate(model.candidates[idx]!)}) at DPR ${model.dpr}.`;
      report = { output, language: 'text' };
    } else {
      report = { output: summaryReport(model), language: 'text' };
    }

    const notes: string[] = [];
    if (model.findings.some((f) => f.severity === 'error')) notes.push('Some candidates are invalid; see Findings.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
