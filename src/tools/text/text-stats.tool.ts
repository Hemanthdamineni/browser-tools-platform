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
] as const;

const READING_WPM = 238;
const SPEAKING_WPM = 130;

/** Round to at most one decimal place, dropping a trailing `.0`. */
function num1(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return (Math.round(n * 10) / 10).toString();
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
  ];

  return asTable(rows);
}

const tool: TextToolModule = { meta, run };
export default tool;
