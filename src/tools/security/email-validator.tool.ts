import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './email-validator.meta';

const MAX_LEN = 300;

const LOCAL_EXTRA = "!#$%&'*+-/=?^_`{|}~";

function checkEmail(raw: string, requireTld: boolean): { rows: string[][]; valid: boolean } {
  const rows: string[][] = [];
  const failures: string[] = [];

  const spaceMatch = /\s/.test(raw);
  rows.push(['Whitespace', spaceMatch ? 'Found' : 'None']);
  if (spaceMatch) failures.push('Email addresses cannot contain whitespace.');

  const atCount = (raw.match(/@/g) ?? []).length;
  rows.push(['At signs', String(atCount)]);
  if (atCount !== 1) failures.push('Exactly one @ is required.');

  const [local = '', domain = ''] = raw.split('@');
  rows.push(['Local part length', String(local.length), local.length > 64 ? 'too long' : 'ok']);
  if (local.length === 0 || local.length > 64) failures.push('Local part must be 1–64 characters.');
  else if (!/^[A-Za-z0-9._%+-]+$/.test(local)) failures.push('Local part has disallowed characters.');
  else {
    let prevDot = false;
    for (let i = 0; i < local.length; i++) {
      const ch = local[i]!;
      if (ch === '.') {
        if (prevDot || i === 0 || i === local.length - 1) {
          failures.push('Dots cannot start, end or repeat in the local part.');
          break;
        }
        prevDot = true;
      } else prevDot = false;
    }
    // allowed specials are a subset we accept conservatively
    const spec = [...local].filter((c) => !/[A-Za-z0-9.]/.test(c));
    for (const c of spec) if (!LOCAL_EXTRA.includes(c)) failures.push('Disallowed character "' + c + '" in local part.');
  }

  rows.push(['Domain length', String(domain.length), domain.length > 253 ? 'too long' : 'ok']);
  const labels = domain.split('.').filter(Boolean);
  rows.push(['Labels', String(labels.length)]);
  rows.push(['TLD', labels.length ? labels[labels.length - 1]! : '—']);
  if (domain.length === 0 || domain.length > 253) failures.push('Domain must be 1–253 characters.');
  else {
    for (const label of labels) {
      if (label.length === 0 || label.length > 63) {
        failures.push('A domain label is too long or empty.');
        break;
      }
      if (!/^[A-Za-z0-9-]+$/.test(label)) {
        failures.push('A domain label contains disallowed characters.');
        break;
      }
      if (label.startsWith('-') || label.endsWith('-')) {
        failures.push('Domain labels cannot start or end with a hyphen.');
        break;
      }
      if (/^[^A-Za-z0-9]/.test(label)) {
        failures.push('Domain labels cannot start with a special character.');
        break;
      }
    }
    const tld = labels[labels.length - 1]!;
    const tldReal = tld.length >= 2 && /^[A-Za-z]+$/.test(tld);
    if (requireTld && !tldReal) failures.push('The top-level domain must be letters of length 2 or more (got "' + tld + '").');
    if (labels.length === 1) failures.push('A domain needs at least two labels (e.g. example.com).');
  }

  const totalLen = raw.length;
  rows.push(['Total length', String(totalLen), totalLen > 254 ? 'too long' : 'ok']);
  if (totalLen > 254) failures.push('Maximum address length is 254 characters.');

  const valid = failures.length === 0;
  rows.push(['Result', valid ? 'Valid' : 'Invalid']);
  return { rows, valid };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const requireTld = o.requireTld !== false;
  const raw = (input.text ?? '').trim();
  if (!raw) throw new ToolError('Enter an email address to validate.', 'Example: ada@example.com');
  if (raw.length > MAX_LEN) throw new ToolError('That is too long for an email address.');

  const { rows } = checkEmail(raw, requireTld);
  const valid = rows[rows.length - 1]![1] === 'Valid';
  return {
    output: JSON.stringify({ headers: ['Check', 'Result', 'Detail'], rows }),
    render: 'table',
    stats: { valid: valid ? 1 : 0 },
    notes: [
      valid
        ? 'This address passes all format checks.'
        : 'One or more checks failed — see the table for details.',
      'Format verification only; delivery cannot be verified without contacting the mail server.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
