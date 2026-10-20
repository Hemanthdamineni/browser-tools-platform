import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './secret-scanner.meta';

type Finding = { start: number; end: number; type: string; value: string };
type Pattern = { type: string; regex: RegExp; group?: number };

const PATTERNS: Pattern[] = [
  {
    type: 'GitHub token',
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  { type: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'AWS access key ID', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { type: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { type: 'Stripe secret key', regex: /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{12,}\b/g },
  { type: 'JWT', regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { type: 'Private key header', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
];

const ASSIGNMENT_PATTERN =
  /\b([A-Za-z_][A-Za-z0-9_.-]*)\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^,;\s}]+))/gim;
const SECRET_KEY = /(?:password|passwd|secret|token|api[_-]?key|client[_-]?secret|access[_-]?key)/i;

function collect(text: string, minLength: number): Finding[] {
  const candidates: Finding[] = [];
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[0];
      candidates.push({
        start: match.index!,
        end: match.index! + value.length,
        type: pattern.type,
        value,
      });
    }
  }
  ASSIGNMENT_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(ASSIGNMENT_PATTERN)) {
    const key = match[1] ?? '';
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (!SECRET_KEY.test(key) || value.length < minLength) continue;
    const start = match.index! + match[0].lastIndexOf(value);
    candidates.push({ start, end: start + value.length, type: 'Secret-like assignment', value });
  }
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const findings: Finding[] = [];
  for (const candidate of candidates) {
    const previous = findings.at(-1);
    if (previous && candidate.start < previous.end) {
      if (candidate.end > previous.end) previous.end = candidate.end;
      continue;
    }
    findings.push(candidate);
  }
  return findings;
}

function location(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = (before.match(/\n/g) ?? []).length + 1;
  const lastNewline = before.lastIndexOf('\n');
  return { line, column: [...before.slice(lastNewline + 1)].length + 1 };
}

function mask(value: string): string {
  if (value.startsWith('-----BEGIN ')) return '[private key material]';
  if (value.length <= 6) return '[REDACTED]';
  return `${value.slice(0, 2)}…${value.slice(-2)} (${value.length} chars)`;
}

function redact(text: string, findings: Finding[]): string {
  let output = '';
  let cursor = 0;
  for (const finding of findings) {
    output += text.slice(cursor, finding.start) + '[REDACTED]';
    cursor = finding.end;
  }
  return output + text.slice(cursor);
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const operation = String(options.operation);
  const minLength = Number(options.minLength);
  if (operation !== 'report' && operation !== 'redact')
    throw new ToolError('Choose a valid scanner operation.');
  if (!Number.isInteger(minLength) || minLength < 8 || minLength > 64)
    throw new ToolError('Minimum length must be a whole number from 8 to 64.');

  const findings = collect(input.text, minLength);
  if (operation === 'redact') {
    return {
      output: redact(input.text, findings),
      render: 'code',
      language: 'text',
      stats: {
        findings: findings.length,
        'characters redacted': findings.reduce((sum, item) => sum + item.value.length, 0),
      },
      notes: [
        'Heuristic scan only: review the output carefully; this is not proof that all credentials were found.',
      ],
    };
  }

  const rows = findings.map((finding) => {
    const { line, column } = location(input.text, finding.start);
    return [finding.type, String(line), String(column), mask(finding.value)];
  });
  return {
    output: JSON.stringify({ headers: ['Finding', 'Line', 'Column', 'Masked preview'], rows }),
    render: 'table',
    stats: { findings: findings.length },
    notes: findings.length
      ? [
          'Secret values are masked in this report. Scan results are heuristic and may include false positives or misses.',
        ]
      : [
          'No recognized credential patterns found; this does not guarantee the text is secret-free.',
        ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
