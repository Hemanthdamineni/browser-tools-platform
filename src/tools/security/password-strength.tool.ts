import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { meta } from './password-strength.meta';

const COMMON = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'abc123',
  'letmein',
  'iloveyou',
  'admin',
  'welcome',
  'monkey',
  'dragon',
  'passw0rd',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'trustno1',
  '111111',
  '000000',
  '1q2w3e4r',
  '1234',
  'freedom',
  'whatever',
]);

function classesOf(pw: string): {
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
} {
  return {
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digits: /[0-9]/.test(pw),
    symbols: /[^A-Za-z0-9]/.test(pw),
  };
}

function poolSize(c: ReturnType<typeof classesOf>): number {
  let n = 0;
  if (c.lower) n += 26;
  if (c.upper) n += 26;
  if (c.digits) n += 10;
  if (c.symbols) n += 33;
  return n;
}

function maxRun(pw: string): number {
  let best = 1;
  let cur = 1;
  for (let i = 1; i < pw.length; i++) {
    cur = pw[i] === pw[i - 1] ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
}

function hasSequence(pw: string): boolean {
  const lowered = pw.toLowerCase();
  for (let i = 0; i + 2 < lowered.length; i++) {
    const a = lowered.charCodeAt(i);
    const b = lowered.charCodeAt(i + 1);
    const c = lowered.charCodeAt(i + 2);
    if ((b === a + 1 && c === b + 1) || (b === a - 1 && c === b - 1)) return true;
  }
  return false;
}

function run(input: TextRunInput): TextRunResult {
  const pw = input.text.trim();
  if (!pw)
    return {
      output: JSON.stringify({
        headers: ['Length', 'Classes', 'Score', 'Bit strength', 'Verdict'],
        rows: [] as string[][],
      }),
      render: 'table',
      stats: { score: 0 },
      notes: [
        'Type a password to analyze its strength. Nothing is uploaded — analysis runs on-device.',
      ],
    };
  const c = classesOf(pw);
  const pool = poolSize(c);
  const length = pw.length;
  const bits = pool > 0 ? Math.round(length * Math.log2(pool) * 10) / 10 : 0;
  const lowerWord = /^[a-z]+$/.test(pw);
  const common = COMMON.has(pw.toLowerCase());
  const repeated = maxRun(pw) >= 3;
  const sequenced = hasSequence(pw);
  const anyClass = [c.lower, c.upper, c.digits, c.symbols].filter(Boolean).length;
  let score = 0;
  const notes: string[] = [];
  score += Math.min(4, Math.floor(length / 4)) * 10; // length base
  score += (anyClass - 1) * 8;
  if (anyClass >= 3) score += 4;
  let verdict = 'Weak';
  if (common) {
    score -= 45;
    notes.push('This is a very commonly used password and is easily guessed by pattern lists.');
  }
  if (lowerWord) {
    score -= 20;
    notes.push(
      'An all-lowercase word is extremely guessable — add numbers, symbols and uppercase.',
    );
  }
  if (repeated) {
    score -= 15;
    notes.push('Repeated characters (three or more in a row) make the password much weaker.');
  }
  if (sequenced) {
    score -= 12;
    notes.push('Contiguous keyboard or alphabet sequences (123, abc, qwe) are quickly cracked.');
  }
  if (length < 8) {
    score -= 20;
    notes.push('Short passwords are trivially brute-forced; aim for at least 12 characters.');
  }
  if (length >= 12) {
    score += 8;
    notes.push('Good length — 12+ characters is a solid baseline.');
  }
  if (c.upper && c.digits && c.symbols) {
    score += 6;
    notes.push('Mixing upper, lower, digits and symbols widens the search space.');
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (score >= 80) verdict = 'Strong';
  else if (score >= 50) verdict = 'Fair';
  if (!notes.length)
    notes.push(
      score >= 80
        ? 'Looks strong. Keep it unique and never reuse it across services.'
        : 'Decent, but see the suggestions to push it higher.',
    );
  const classLabel =
    `${c.lower ? 'LC' : ''}${c.upper ? 'UC' : ''}${c.digits ? '09' : ''}${c.symbols ? 'S!' : ''}` ||
    'none';
  const rows = [[String(length), classLabel, String(score), String(bits) + ' bits', verdict]];
  return {
    output: JSON.stringify({
      headers: ['Length', 'Classes', 'Score', 'Bit strength', 'Verdict'],
      rows,
    }),
    render: 'table',
    stats: { length, score, bits, classes: anyClass },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
