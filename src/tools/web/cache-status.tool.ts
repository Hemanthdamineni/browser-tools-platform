import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cache-status.meta';

const TOKEN_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
function splitMembers(field: string): string[] {
  const members: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of field) {
    if (inQuotes) {
      if (char === '"') inQuotes = false;
      current += char;
      continue;
    }
    if (char === '"') { inQuotes = true; current += char; continue; }
    if (char === ';' && current.trim()) { members.push(current.trim()); current = ''; continue; }
    current += char;
  }
  if (current.trim()) members.push(current.trim());
  return members;
}
function splitParams(member: string): string[] {
  const params: string[] = [member];
  let current = '';
  let inQuotes = false;
  for (const char of member) {
    if (inQuotes) {
      if (char === '"') inQuotes = false;
      current += char;
      continue;
    }
    if (char === '"') { inQuotes = true; current += char; continue; }
    if (char === ';' && current.trim()) { params.push(current.trim()); current = ''; continue; }
    current += char;
  }
  if (current.trim()) params.push(current.trim());
  return params;
}
function inspectMember(member: string): { name: string; value: string; status: 'Valid' | 'Warn' | 'Unknown'; note: string } {
  const cleaned = member.trim();
  const eq = cleaned.indexOf('=');
  const eqName = (eq >= 0 ? cleaned.slice(0, eq) : cleaned).trim();
  const eqValue = eq >= 0 ? cleaned.slice(eq + 1) : '';
  const lowerName = eqName.toLowerCase();
  const stripQuotes = (raw: string) => raw.trim().replace(/^"|"$/g, '');
  // Boolean/marker members: hit, miss, pass, stored, stale, collapsed, partial, waiting
  if (['hit', 'pass', 'stored', 'stale', 'collapsed', 'partial', 'waiting'].includes(lowerName) && !eqValue)
    return { name: eqName, value: '', status: 'Valid', note: `Cache ${lowerName}: ${lowerName === 'hit' ? 'served a hit' : lowerName === 'pass' ? 'passed through without reuse' : lowerName === 'stored' ? 'stored the response' : lowerName === 'stale' ? 'reused while stale' : lowerName === 'collapsed' ? 'collapsed a request' : lowerName === 'partial' ? 'served a partial response' : 'waited for a revalidation'}` };
  if (lowerName === 'miss')
    return { name: eqName, value: !eqValue ? 'pragma' : stripQuotes(eqValue), status: eqValue ? 'Valid' : 'Valid', note: `miss: the cache did not have a fresh copy${eqValue ? ` with revalidation reason "${stripQuotes(eqValue)}"` : ' (plain miss)'}` };
  if (lowerName === 'ttl') {
    const v = eqValue.trim();
    if (!v) return { name: eqName, value: '', status: 'Warn', note: 'ttl declares a lifetime in seconds; provide like ttl=60' };
    if (v.startsWith('dt=')) {
      const days = v.slice(3);
      if (!/^\d+$/.test(days)) return { name: eqName, value: v, status: 'Warn', note: 'ttl dt= value should be an integer of days' };
      return { name: eqName, value: v, status: 'Valid', note: `ttl dt=${days} days ≈ ${Number(days) * 86400}s` };
    }
    if (!/^\d+$/.test(v)) return { name: eqName, value: v, status: 'Warn', note: 'ttl expects a non-negative integer (e.g. ttl=60)' };
    return { name: eqName, value: v, status: 'Valid', note: `ttl=${v}s — for roughly ${Math.round(Number(v) / 86400 * 10) / 10} days` };
  }
  if (lowerName === 'fwd') {
    if (!eqValue) return { name: eqName, value: '', status: 'Warn', note: 'fwd declares forwarding during a miss; commonly fwd=urlll, fwd=req, fwd=stale' };
    const reason = stripQuotes(eqValue);
    if (['urlll', 'stale', 'req', 'immutable', 'req-title', 'cli'].includes(reason)) return { name: eqName, value: reason, status: 'Valid', note: `Forwarded with reason "${reason}"` };
    const params = splitParams(eqValue).slice(1);
    return { name: eqName, value: reason, status: params.length ? 'Valid' : 'Unknown', note: params.length ? `Forwarded with reason "${reason}" plus parameters` : `Forwarding reason "${reason}" is not one of the defined values (req, stale, urlll, immutable, etc.)` };
  }
  if (/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(lowerName) && eqValue) return { name: eqName, value: stripQuotes(eqValue), status: 'Warn', note: `Implementation-defined parameter "${eqName}" with value "${stripQuotes(eqValue)}"` };
  return { name: eqName, value: stripQuotes(eqValue), status: eqValue ? 'Warn' : 'Unknown', note: eqValue ? `Unrecognized parameter "${eqName}" — behavior is implementation-defined` : `Unrecognized marker "${eqName}" — behavior is implementation-defined` };
}
function analyze(text: string): { rows: string[][]; issues: number; summary: string } {
  const trimmed = text.trim();
  const firstSemi = trimmed.indexOf(';');
  const cacheName = firstSemi >= 0 ? trimmed.slice(0, firstSemi).trim() : trimmed;
  if (!cacheName) return { rows: [], issues: 1, summary: 'No Cache-Status header value provided.' };
  const rest = firstSemi >= 0 ? trimmed.slice(firstSemi + 1) : '';
  let issues = 0;
  const rows = splitMembers(rest).map((member) => { const inspected = inspectMember(member); if (inspected.status === 'Unknown' || inspected.status === 'Warn') issues++; return [inspected.name, inspected.value || '(none)', inspected.status, inspected.note]; });
  return { rows, issues, summary: `${cacheName} report:` };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'analyze' && mode !== 'build') throw new ToolError('Choose a supported mode.');
  if (mode === 'build') {
    const cc = String(options.cc).trim();
    const hit = String(options.hit);
    const ttl = String(options.ttl).trim();
    const fwd = String(options.fwd).trim();
    if (!cc || !TOKEN_RE.test(cc)) throw new ToolError('Cache name must be a non-empty structured-field token.');
    const members = [cc, hit];
    if (ttl) members.push(`ttl=${ttl}`);
    if (fwd) members.push(`fwd=${TOKEN_RE.test(fwd) ? fwd : `"${fwd}"`}`);
    return { output: members.join('; '), render: 'code', language: 'http', filename: 'cache-status.txt', stats: { cache: cc, result: hit, ttl: ttl || 'n/a' } };
  }
  if (!input.text.trim()) return { output: JSON.stringify({ headers: ['Parameter', 'Value', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste a Cache-Status header value to analyze.'] };
  const inspected = analyze(input.text);
  return { output: JSON.stringify({ headers: ['Parameter', 'Value', 'Status', 'Assessment'], rows: inspected.rows }), render: 'table', stats: { parameters: inspected.rows.length, issues: inspected.issues }, notes: inspected.issues ? [inspected.summary + ' Flagged ' + inspected.issues + ' parameter(s).'] : [inspected.summary + ' All parameters recognized.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
