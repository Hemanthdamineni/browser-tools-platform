import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-summarizer.meta';

type Sentence = { text: string; order: number; tokens: string[]; score: number };

const STOP_WORDS = new Set(
  `a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in into is it its me more most my no nor not of on or our ours out over so some such than that the their theirs them then there these they this those to too up us was we were what when where which while who whom why will with would you your yours about above after again against all am any because before below between both down during each few further hadnt have been having here hers herself herself i'd i'll i'm i've if in into isn't it's itself itself just lets me mine more moreover most mustn't myself nor now o off once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't shouldn't some such than that the their theirs them themselves then there these they this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what when where which while who whom why with won't won't would wouldn't wouldn't you you'd you'll you're you've your yours yourself yourselves`.split(
    /\s+/,
  ),
);

export function splitSentences(text: string): string[] {
  const abbr = new Set([
    'mr',
    'mrs',
    'ms',
    'dr',
    'prof',
    'sr',
    'jr',
    'hon',
    'st',
    'vs',
    'etc',
    'ie',
    'eg',
    'al',
    'inc',
    'ltd',
    'co',
    'dept',
    'gen',
    'col',
    'capt',
    'lt',
    'maj',
    'sgt',
    'no',
    'fig',
    'approx',
    'est',
    'rev',
    'vol',
  ]);
  const sentences: string[] = [];
  let buf = '';
  const isUpper = (c: string) => /[A-Z]/.test(c);
  const isDigit = (c: string) => /[0-9]/.test(c);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    buf += ch;
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    // Consume a run of terminator characters.
    let j = i;
    while (j + 1 < text.length && /[.!?]/.test(text[j + 1]!)) {
      buf += text[j + 1]!;
      j++;
    }
    // The terminator is only a real boundary if followed by whitespace + uppercase/digit or end.
    const afterWs = j + 1;
    if (afterWs >= text.length) {
      sentences.push(buf.trim());
      buf = '';
      i = j;
      continue;
    }
    if (!/\s/.test(text[afterWs]!)) {
      i = j;
      continue;
    }
    let k = afterWs;
    while (k < text.length && /\s/.test(text[k]!)) k++;
    if (k >= text.length) {
      sentences.push(buf.trim());
      buf = '';
      i = j;
      continue;
    }
    const nxt = text[k]!;
    if (!isUpper(nxt) && !isDigit(nxt)) {
      i = j;
      continue;
    }
    // Avoid splitting decimals: "3.14"
    const prev = buf.trim().slice(-2, -1) ?? '';
    if (ch === '.' && isDigit(prev) && isDigit(nxt)) {
      i = j;
      continue;
    }
    // Avoid splitting after common abbreviations / initials ("Dr. Smith", "J. Doe").
    if (ch === '.') {
      const m = /([A-Za-z]+)\.?$/.exec(buf.trim());
      const word = m ? m[1]!.toLowerCase() : '';
      if (abbr.has(word) || (word.length === 1 && /[A-Za-z]/.test(word))) {
        i = j;
        continue;
      }
    }
    sentences.push(buf.trim());
    buf = '';
    i = j;
  }
  const rest = buf.trim();
  if (rest) sentences.push(rest);
  return sentences.filter((s) => s.length > 0);
}

function tokenize(sentence: string): string[] {
  return (sentence.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []).filter(
    (w) => w.length >= 3 && !STOP_WORDS.has(w),
  );
}

function scoreSentences(sentences: string[]): Sentence[] {
  const allTokens = sentences.flatMap((s) => tokenize(s));
  const freq = new Map<string, number>();
  for (const w of allTokens) freq.set(w, (freq.get(w) ?? 0) + 1);
  const totalSents = sentences.length;
  return sentences.map((text, order) => {
    const tokens = tokenize(text);
    let sum = 0;
    for (const w of tokens) sum += freq.get(w) ?? 0;
    const contentN = tokens.length;
    // Normalise by the square root of word count so long enumerations don't dominate,
    // and add a small position bonus for the very first sentence.
    const score = contentN ? sum / Math.sqrt(contentN) : 0;
    const positionBonus = order === 0 && text.length < 160 ? Math.max(0.5, totalSents / 8) : 0;
    return { text, order, tokens, score: score + positionBonus };
  });
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const length = String(o.length);
  const customCount = Math.max(1, Math.trunc(Number(o.count)));
  const text = input.text.trim();

  if (!text) {
    return {
      output: JSON.stringify({ headers: ['Stat', 'Value'], rows: [] as string[][] }),
      render: 'table',
      notes: [
        'Paste a document of a few sentences or more to extract its most important sentences.',
      ],
    };
  }

  const sentences = splitSentences(text);
  if (sentences.length === 0) throw new ToolError('No sentences found — check the input.');
  const wordCount = (text.match(/\S+/g) ?? []).length;
  if (wordCount < 10) {
    throw new ToolError('This text is too short to summarize meaningfully (fewer than 10 words).');
  }

  const ranked = scoreSentences(sentences).sort((a, b) => b.score - a.score);
  let target = 0;
  if (length === 'custom') target = customCount;
  else if (sentences.length <= 2) target = 1;
  else {
    const ratio = length === 'short' ? 0.15 : length === 'long' ? 0.45 : 0.3;
    target = Math.max(1, Math.min(sentences.length, Math.round(sentences.length * ratio)));
  }
  const selected = new Set(ranked.slice(0, target).map((s) => s.order));
  const picked = sentences.filter((_, i) => selected.has(i));

  const summaryWords = picked.join(' ').replace(/\s+/g, ' ').trim();
  const keptWords = summaryWords ? (summaryWords.match(/\S+/g) ?? []).length : 0;

  return {
    output: summaryWords,
    render: 'text',
    filename: 'summary.txt',
    stats: {
      sentences: sentences.length,
      selected: picked.length,
      words: wordCount,
      summaryWords: keptWords,
      compression: Math.round((1 - keptWords / Math.max(1, wordCount)) * 100),
    },
    notes: [
      'Top sentences are shown in their original order. Words that recur across the document drive the ranking.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
