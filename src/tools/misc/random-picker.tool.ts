import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './random-picker.meta';

function randomIndex(n: number): number {
  // Unbiased sample in [0, n) using crypto.getRandomValues rejection sampling.
  const LIMIT = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= LIMIT);
  return x % n;
}

function parseItems(input: string, trim: boolean, dropBlank: boolean): string[] {
  let lines = input.split(/\r\n|\r|\n/);
  if (lines.length === 1) {
    // Single line — allow comma-separated values.
    const csv = lines[0]!.split(',');
    lines = csv.length > 1 ? csv : lines;
  }
  if (trim) lines = lines.map((l) => l.trim());
  if (dropBlank) lines = lines.filter((l) => l.length > 0);
  return lines;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const trim = Boolean(o.trimLines);
  const dropBlank = Boolean(o.dropBlank);
  const items = parseItems(input.text, trim, dropBlank);
  if (items.length === 0)
    throw new ToolError(
      'Enter at least one item to pick from.',
      'One item per line, or comma-separated values.',
    );

  if (mode === 'pick') {
    const count = Math.floor(Number(o.pickCount) || 1);
    const allowDup = Boolean(o.allowDuplicates);
    if (count < 1 || count > 1000) throw new ToolError('Pick count must be between 1 and 1000.');
    if (!allowDup && count > items.length) {
      throw new ToolError(
        `Cannot pick ${count} distinct items from a list of ${items.length}.`,
        'Allow duplicates or pick fewer items.',
      );
    }
    const picked: string[] = [];
    if (allowDup) {
      for (let i = 0; i < count; i++) picked.push(items[randomIndex(items.length)]!);
    } else {
      const pool = shuffle(items);
      for (let i = 0; i < count; i++) picked.push(pool[i]!);
    }
    return { output: picked.join('\n'), render: 'text', stats: { picked: picked.length } };
  }

  if (mode === 'teams') {
    const teams = Math.floor(Number(o.teamCount) || 2);
    if (teams < 2 || teams > 50) throw new ToolError('Team count must be between 2 and 50.');
    const deck = shuffle(items);
    const groups: string[][] = Array.from({ length: teams }, () => []);
    deck.forEach((item, i) => groups[i % teams]!.push(item));
    const rows = groups.map((g, i) => [String(i + 1), g.join(', ')]);
    return {
      output: JSON.stringify({ headers: ['Team', 'Members'], rows }),
      render: 'table',
      stats: { teams },
    };
  }

  // shuffle / order
  const result = shuffle(items).join('\n');
  return { output: result, render: 'text', stats: { items: items.length } };
}

const tool: TextToolModule = { meta, run };
export default tool;
