import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-stats.meta';

const METRICS = [
  'Characters',
  'Characters (no spaces)',
  'Words',
  'Unique words',
  'Sentences',
  'Paragraphs',
  'Lines',
  'Reading time',
  'Speaking time',
  'Average word length',
  'Longest word',
  'Average sentence length (words)',
  'X (Twitter) — 280',
  'LinkedIn — 3000',
  'Instagram — 2200',
  'Meta description — 155–160',
  'SMS — 160/segment',
  'Flesch Reading Ease',
  'Flesch-Kincaid Grade',
  'Gunning Fog',
  'SMOG',
  'ARI',
  'Coleman-Liau',
  'Syllables (estimated)',
  'Syllables per word',
] as const;

const READING_WPM = 238;
const SPEAKING_WPM = 130;

const X_LIMIT = 280;
const LINKEDIN_LIMIT = 3000;
const INSTAGRAM_LIMIT = 2200;
const META_MIN = 155;
const META_MAX = 160;
const SMS_SEGMENT = 160;

const VOWELS = 'aeiouy';

/** Round to at most one decimal place, dropping a trailing `.0`. */
function num1(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return (Math.round(n * 10) / 10).toString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function humanDuration(words: number, wpm: number): string {
  const seconds = Math.round((words / wpm) * 60);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function asTable(rows: string[][]): TextRunResult {
  return {
    output: JSON.stringify({ headers: ['Metric', 'Value'], rows }),
    render: 'table',
  };
}

/**
 * Estimate syllables for one word using a vowel-group heuristic (documented):
 * every run of vowels (a, e, i, o, u, y) counts as one syllable, then a final
 * silent "e" is dropped — but a word never counts below one syllable. This is
 * close for English without a dictionary, so the readability scores built on it
 * are estimates, not a dictionary-exact count.
 */
function countSyllables(raw: string): number {
  const word = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (word === '') return 0;
  let count = 0;
  let prevVowel = false;
  for (const ch of word) {
    const isVowel = VOWELS.includes(ch);
    if (isVowel && !prevVowel) count += 1;
    prevVowel = isVowel;
  }
  // Silent trailing "e" ("like", "have") — never drop below one syllable.
  if (word.length > 2 && word.endsWith('e') && !VOWELS.includes(word[word.length - 2]!)) {
    count = Math.max(1, count - 1);
  }
  return Math.max(1, count);
}

/** Letter-based tokens (hyphens and apostrophes stay inside the word). */
function letterTokens(text: string): string[] {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
}

/** Count sentences that contain at least one letter-based word. */
function letterSentences(text: string): number {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  let n = 0;
  for (const part of parts) if (letterTokens(part).length > 0) n += 1;
  return n;
}

/** Fit/over status for a fixed character limit. */
function fitStatus(len: number, limit: number): string {
  if (len < limit) return `${len} / ${limit} · ${limit - len} left`;
  if (len === limit) return `${len} / ${limit} · at limit`;
  return `${len} / ${limit} · ${len - limit} over`;
}

/** Meta description is a 155–160 character band. */
function metaStatus(len: number): string {
  if (len < META_MIN) return `${len} · ${META_MIN - len} short of 155`;
  if (len <= META_MAX) return `${len} · within 155–160`;
  return `${len} · ${len - META_MAX} over 160`;
}

/** SMS packs 160 characters per segment (standard single-part GSM). */
function smsStatus(len: number): string {
  const segments = Math.ceil(len / SMS_SEGMENT);
  return `${len} · ${segments} segment${segments > 1 ? 's' : ''}`;
}

function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);
  const text = input.text;
  if (!text) return asTable(METRICS.map((m) => [m, '0']));

  const characters = [...text].length;
  const charactersNoSpaces = [...text.replace(/\s/g, '')].length;

  const trimmed = text.trim();
  const words = trimmed.length ? trimmed.split(/\s+/) : [];
  const wordCount = words.length;

  const normalized = words
    .map((w) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
  const uniqueWords = new Set(normalized).size;

  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;

  const lines = text.split(/\r\n|\r|\n/).length;

  let longestWord = '';
  let totalWordLength = 0;
  for (const w of words) {
    totalWordLength += w.length;
    if (w.length > longestWord.length) longestWord = w;
  }
  const avgWordLength = wordCount ? totalWordLength / wordCount : 0;
  const avgSentenceLength = sentences ? wordCount / sentences : 0;

  // Readability is based on letter-token words, so punctuation and short
  // whitespace-split tokens (e.g. "123") do not skew syllable/letter counts.
  const tokens = letterTokens(text);
  let syllables = 0;
  let letters = 0;
  let polysyllables = 0;
  for (const token of tokens) {
    const s = countSyllables(token);
    syllables += s;
    if (s >= 3) polysyllables += 1;
    letters += token.replace(/[^A-Za-z]/g, '').length;
  }

  let ease = '0';
  let fk = '0';
  let fog = '0';
  let smog = '0';
  let ari = '0';
  let cl = '0';
  let syllablesPerWord = '0';
  if (tokens.length > 0) {
    const rSentences = Math.max(1, letterSentences(text));
    const wps = tokens.length / rSentences;
    const spw = syllables / tokens.length;
    const lpw = letters / tokens.length;
    const complexPct = (polysyllables / tokens.length) * 100;
    const lengthScore = 4.71 * lpw + 0.5 * wps - 21.43;
    const letterScore = 0.0588 * lpw * 100 - 0.296 * (rSentences / tokens.length) * 100 - 15.8;
    ease = num1(clamp(206.835 - 1.015 * wps - 84.6 * spw, 0, 100));
    fk = num1(clamp(0.39 * wps + 11.8 * spw - 15.59, 0, 20));
    fog = num1(clamp(0.4 * (wps + complexPct), 0, 20));
    smog = num1(clamp(1.043 * Math.sqrt((30 * polysyllables) / rSentences) + 3.1291, 0, 20));
    ari = num1(clamp(lengthScore, 0, 20));
    cl = num1(clamp(letterScore, 0, 20));
    syllablesPerWord = num1(syllables / tokens.length);
  }

  const rows: string[][] = [
    ['Characters', String(characters)],
    ['Characters (no spaces)', String(charactersNoSpaces)],
    ['Words', String(wordCount)],
    ['Unique words', String(uniqueWords)],
    ['Sentences', String(sentences)],
    ['Paragraphs', String(paragraphs)],
    ['Lines', String(lines)],
    ['Reading time', humanDuration(wordCount, READING_WPM)],
    ['Speaking time', humanDuration(wordCount, SPEAKING_WPM)],
    ['Average word length', num1(avgWordLength)],
    ['Longest word', longestWord],
    ['Average sentence length (words)', num1(avgSentenceLength)],
    ['X (Twitter) — 280', fitStatus(characters, X_LIMIT)],
    ['LinkedIn — 3000', fitStatus(characters, LINKEDIN_LIMIT)],
    ['Instagram — 2200', fitStatus(characters, INSTAGRAM_LIMIT)],
    ['Meta description — 155–160', metaStatus(characters)],
    ['SMS — 160/segment', smsStatus(characters)],
    ['Flesch Reading Ease', ease],
    ['Flesch-Kincaid Grade', fk],
    ['Gunning Fog', fog],
    ['SMOG', smog],
    ['ARI', ari],
    ['Coleman-Liau', cl],
    ['Syllables (estimated)', String(syllables)],
    ['Syllables per word', syllablesPerWord],
  ];

  return {
    ...asTable(rows),
    stats: {
      characters,
      words: wordCount,
      sentences,
      syllables,
      ease: Number(ease),
      grade: Number(fk),
    },
    notes: [
      'Platform rows show the character count against each limit and how far you are from it.',
      'Readability scores use the standard formulas (Flesch, Flesch-Kincaid, Gunning Fog, SMOG, ARI, Coleman-Liau).',
      'Syllables are estimated from vowel groups, so the scores are estimates, not dictionary-exact.',
      'SMS assumes 160 characters per segment; multi-segment texts reserve header space in practice.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
