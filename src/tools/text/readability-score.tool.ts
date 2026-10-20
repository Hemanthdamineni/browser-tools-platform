import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './readability-score.meta';

const MAX_LEN = 200_000;
const VOWELS = 'aeiouy';

/** Estimate syllables for a single word using vowel-group heuristics. */
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
  // Silent trailing "e" ("like", "have") — but never drop below one syllable.
  if (word.length > 2 && word.endsWith('e') && !VOWELS.includes(word[word.length - 2]!)) {
    count = Math.max(1, count - 1);
  }
  return Math.max(1, count);
}

function tokenize(text: string): string[] {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
}

function countSentences(text: string): number {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  let n = 0;
  for (const part of parts) if (tokenize(part).length > 0) n += 1;
  return n;
}

interface Counts {
  words: number;
  sentences: number;
  syllables: number;
  letters: number;
}

function analyze(text: string): Counts {
  const tokens = tokenize(text);
  let syllables = 0;
  let letters = 0;
  for (const token of tokens) {
    syllables += countSyllables(token);
    letters += token.replace(/[^A-Za-z]/g, '').length;
  }
  return {
    words: tokens.length,
    sentences: countSentences(text),
    syllables,
    letters,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function easeLabel(score: number): string {
  if (score >= 90) return 'Very easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly easy';
  if (score >= 60) return 'Plain English';
  if (score >= 50) return 'Fairly difficult';
  if (score >= 30) return 'Difficult';
  return 'Very difficult';
}

function gradeLabel(grade: number): string {
  if (grade <= 5) return 'Primary school';
  if (grade <= 8) return 'Middle school';
  if (grade <= 12) return 'High school';
  if (grade <= 16) return 'College';
  return 'Graduate level';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const showDetails = o.showDetails !== false;

  const raw = String(input.text ?? '');
  if (raw.trim() === '') throw new ToolError('Paste some text to score its readability.');
  if (raw.length > MAX_LEN) {
    throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');
  }

  const counts = analyze(raw);
  if (counts.words === 0) {
    throw new ToolError('No words found.', 'The text needs at least one word made of letters.');
  }

  const words = counts.words;
  const sentences = Math.max(1, counts.sentences);
  const syllables = counts.syllables;

  const wordsPerSentence = words / sentences;
  const syllablesPerWord = syllables / words;

  const ease = clamp(206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord, 0, 100);
  const grade = clamp(0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59, 0, 20);

  const rows: string[][] = [
    ['Flesch Reading Ease', round(ease, 1).toFixed(1) + ' / 100', easeLabel(ease)],
    ['Flesch-Kincaid Grade Level', 'Grade ' + round(grade, 1).toFixed(1), gradeLabel(grade)],
    ['Words per sentence', round(wordsPerSentence, 1).toFixed(1), 'Lower is easier'],
    ['Syllables per word', round(syllablesPerWord, 2).toFixed(2), 'Lower is easier'],
  ];
  if (showDetails) {
    rows.push(['Words', String(words), '—']);
    rows.push(['Sentences', String(sentences), '—']);
    rows.push(['Syllables (estimated)', String(syllables), '—']);
    rows.push(['Letters', String(counts.letters), '—']);
  }

  const notes: string[] = [
    'Flesch Reading Ease: 0–100, higher is easier; 60–70 is plain English.',
    'Flesch-Kincaid Grade Level: the US school grade needed to understand the text.',
    'Syllables are estimated from vowel groups, so proper nouns can shift the score slightly.',
  ];
  if (words < 100) {
    notes.push('Short sample (' + words + ' word(s)) — treat the score as indicative only.');
  }

  return {
    output: JSON.stringify({ headers: ['Metric', 'Value', 'Interpretation'], rows }),
    render: 'table',
    stats: { words, sentences, syllables, ease: round(ease, 1), grade: round(grade, 1) },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
