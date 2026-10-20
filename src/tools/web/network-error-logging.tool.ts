import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './network-error-logging.meta';

function inspectPolicy(text: string): { issues: string[]; policy: Record<string, unknown> | null } {
  const issues: string[] = [];
  let policy: Record<string, unknown> | null = null;
  try {
    policy = JSON.parse(text) as Record<string, unknown>;
  } catch {
    issues.push('Policy must be valid JSON');
    return { issues, policy: null };
  }
  if (typeof policy !== 'object' || policy === null || Array.isArray(policy)) {
    issues.push('Policy must be a JSON object');
    return { issues, policy: null };
  }
  const has = (key: string) => key in policy;
  if (!has('report_to')) issues.push('Missing required field report_to');
  else if (typeof policy.report_to !== 'string' || !String(policy.report_to).trim())
    issues.push('report_to must be a non-empty string naming a reporting endpoint group');
  if (!has('max_age')) issues.push('Missing required field max_age');
  else if (
    typeof policy.max_age !== 'number' ||
    !Number.isInteger(policy.max_age) ||
    (policy.max_age as number) < 0
  )
    issues.push('max_age must be a non-negative integer number of seconds');
  if (has('include_subdomains') && typeof policy.include_subdomains !== 'boolean')
    issues.push('include_subdomains must be a boolean');
  if (
    has('failure_mode') &&
    policy.failure_mode !== 'fail-open' &&
    policy.failure_mode !== 'fail-closed'
  )
    issues.push('failure_mode must be fail-open or fail-closed');
  if (has('success_fraction')) {
    const value = policy.success_fraction;
    if (typeof value !== 'number' || (value as number) < 0 || (value as number) > 1)
      issues.push('success_fraction must be a number between 0 and 1');
  }
  return { issues, policy };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported NEL mode.');
  if (mode === 'build') {
    const reportTo = String(options.report_to).trim();
    const maxAge = String(options.max_age).trim();
    const includeSubdomains = String(options.include_subdomains) === 'true';
    const failureMode = String(options.failure_mode);
    const successFraction = String(options.success_fraction || '0').trim();
    const policy: Record<string, unknown> = { report_to: reportTo, max_age: Number(maxAge) };
    if (includeSubdomains) policy.include_subdomains = true;
    if (failureMode !== 'fail-open') policy.failure_mode = 'fail-closed';
    if (successFraction !== '0') policy.success_fraction = Number(successFraction);
    const issues = inspectPolicy(JSON.stringify(policy));
    if (issues.issues.length) throw new ToolError(issues.issues[0]!);
    return {
      output: JSON.stringify(policy, null, 2),
      render: 'code',
      language: 'json',
      filename: 'nel-policy.json',
      stats: { fields: Object.keys(policy).length },
    };
  }
  const text = input.text.trim();
  if (!text)
    return {
      output: JSON.stringify({ headers: ['Field', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste a Network-Error-Logging policy JSON to analyze.'],
    };
  const result = inspectPolicy(text);
  const rows: string[][] = [];
  if (result.policy)
    for (const [key, value] of Object.entries(result.policy)) {
      const status = result.issues.length ? 'Review' : 'Valid';
      rows.push([key, status, String(value)]);
    }
  for (const issue of result.issues) rows.push([issue.split(' ')[0] ?? 'NEL']);
  return {
    output: JSON.stringify({ headers: ['Field', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      fields: result.policy ? Object.keys(result.policy).length : 0,
      issues: result.issues.length,
    },
    notes: result.issues.length
      ? result.issues
      : [
          'Policy valid. Ensure the report_to endpoint is configured via a Reporting-Endpoints header on this origin; logs are delivered to that URL.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
