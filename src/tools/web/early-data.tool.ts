import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './early-data.meta';

function inspect(value: string): string[] { const trimmed = value.trim(); if (!trimmed) return ['Early-Data value is empty']; if (trimmed !== '0') return ['Early-Data must be exactly 0', 'Only the standardized 0 signal is supported']; return []; }
function run(input: TextRunInput): TextRunResult { const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Early-Data mode.'); const value = mode === 'build' ? String(options.value) : input.text; const issues = inspect(value); if (mode === 'build') { if (issues.length) throw new ToolError(issues[0]!); return { output: '0', render: 'code', language: 'http', filename: 'early-data.txt', stats: { signal: '0' } }; } if (!value.trim()) return { output: JSON.stringify({ headers: ['Value', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste an Early-Data value, normally 0.'] }; return { output: JSON.stringify({ headers: ['Value', 'Status', 'Assessment'], rows: [[value.trim(), issues.length ? 'Review' : 'Valid', issues.join('; ') || 'TLS 1.3 early-data signal']] }), render: 'table', stats: { signals: 1, issues: issues.length }, notes: issues.length ? issues : ['Early data can be replayed; protect unsafe operations and consider responding 425 Too Early.'] }; }
const tool: TextToolModule = { meta, run };
export default tool;
