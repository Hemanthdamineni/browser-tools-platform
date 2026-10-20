import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './sunset-deprecation.meta';

const IMF =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;
function inspectDate(date: string): string[] {
  const issues: string[] = [];
  if (!IMF.test(date)) {
    const parsed = Date.parse(date);
    issues.push(
      Number.isNaN(parsed)
        ? 'Invalid HTTP-date; expected IMF-fixdate such as Wed, 15 Mar 2028 00:00:00 GMT'
        : 'Use IMF-fixdate; this appears to be an obsolete HTTP-date form',
    );
  } else {
    const parsed = Date.parse(date);
    if (Number.isNaN(parsed)) issues.push('Invalid calendar date');
    else if (parsed < Date.now())
      issues.push(
        'Deprecation or sunset date is in the past; consider confirming intent or renewing',
      );
    else if (parsed > Date.now() + 315360000000)
      issues.push('Date is more than ten years away; verify lifecycle policy');
  }
  return issues;
}
function inspect(
  value: string,
  kind: 'sunset' | 'deprecation',
): { legitName: string; normalized: string; issues: string[] } {
  const issues: string[] = [];
  let normalized = value.trim();
  const match = /^(Sunset|Deprecation)\s*:\s*(.*)$/i.exec(value.trim());
  let legitName = kind === 'sunset' ? 'Sunset' : 'Deprecation';
  if (match) {
    const declared = match[1]!.toLowerCase();
    if (declared !== kind)
      issues.push(
        `Header name mismatch: expected ${kind === 'sunset' ? 'Sunset' : 'Deprecation'} but found ${match[1]}`,
      );
    else legitName = match[1]!;
    normalized = match[2]!.trim();
  }
  return { legitName, normalized, issues: [...issues, ...inspectDate(normalized)] };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.');
  const kind = String(options.header) === 'deprecation' ? 'deprecation' : 'sunset';
  if (mode === 'build') {
    const date = String(options.date).trim();
    const link = String(options.link).trim();
    const headerName = kind === 'sunset' ? 'Sunset' : 'Deprecation';
    const issues = inspectDate(date);
    if (issues.length) throw new ToolError(issues[0]!);
    const value = link ? `${date}; Link=<${link}>` : date;
    const output = `${headerName}: ${value}`;
    return {
      output,
      render: 'code',
      language: 'http',
      filename: `${kind}.txt`,
      stats: { header: headerName, link: link ? 'yes' : 'no', format: 'IMF-fixdate' },
    };
  }
  const text = input.text.trim();
  if (!text)
    return {
      output: JSON.stringify({ headers: ['Header', 'Date', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste a Sunset or Deprecation header value, with or without the header name.'],
    };
  const values = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = values.map((value) => {
    const inspected = inspect(value, kind);
    const invalid = inspected.issues.some(
      (issue) => issue.startsWith('Invalid') || issue.startsWith('Header name'),
    );
    return [
      inspected.legitName,
      inspected.normalized || value,
      invalid ? 'Invalid' : inspected.issues.length ? 'Review' : 'Valid',
      inspected.issues.join('; ') || `${kind === 'sunset' ? 'Sunset' : 'Deprecation'} date okay`,
    ];
  });
  return {
    output: JSON.stringify({ headers: ['Header', 'Date', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      lines: values.length,
      invalid: rows.filter((row) => row[2] === 'Invalid').length,
      review: rows.filter((row) => row[2] === 'Review').length,
    },
    notes: [
      kind === 'sunset'
        ? 'Sunset announces planned removal; clients should treat the URL as unreliable after the date.'
        : 'Deprecation signals functionality that still works but is slated for removal; use the Link to guide migration.',
    ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
