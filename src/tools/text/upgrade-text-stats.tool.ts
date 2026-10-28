import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './upgrade-text-stats.meta';

const PLATFORM_LIMITS: Record<string, { name: string; limit: number; unit: 'chars' | 'words' }> = {
  x: { name: 'X / Twitter', limit: 280, unit: 'chars' },
  linkedin: { name: 'LinkedIn', limit: 3000, unit: 'chars' },
  instagram: { name: 'Instagram', limit: 2200, unit: 'chars' },
  'meta-description': { name: 'Meta Description', limit: 160, unit: 'chars' },
  sms: { name: 'SMS', limit: 160, unit: 'chars' },
  'email-subject': { name: 'Email Subject', limit: 60, unit: 'chars' },
};

const READING_WPM = 238;
const SPEAKING_WPM = 130;
const VOWELS = 'aeiouy';

function countSyllables(raw: string): number {
  const word = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (word === '') return 0;
  let count = 0;
  let prevVowel = false;
  for (const ch of word) {
    const isVowel = VOWELS.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  if (word.length > 2 && word.endsWith('e') && !VOWELS.includes(word[word.length - 2]!)) {
    count = Math.max(1, count - 1);
  }
  return Math.max(1, count);
}

function tokenize(text: string): string[] {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean).length;
}

interface Counts {
  words: number;
  sentences: number;
  syllables: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  lines: number;
}

function analyze(text: string): Counts {
  const wordsArr = tokenize(text);
  const words = wordsArr.length;
  const sentences = countSentences(text);
  const syllables = wordsArr.reduce((sum, w) => sum + countSyllables(w), 0);
  const characters = [...text].length;
  const charactersNoSpaces = [...text.replace(/\s/g, '')].length;
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).length;
  const lines = text.split(/\r\n|\r|\n/).length;
  return { words, sentences, syllables, characters, charactersNoSpaces, paragraphs, lines };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function easeLabel(score: number): string {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th–9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th–12th grade)';
  if (score >= 30) return 'Difficult (College)';
  return 'Very Difficult (College Graduate)';
}

function gradeLabel(grade: number): string {
  if (grade <= 5) return 'Elementary';
  if (grade <= 8) return 'Middle School';
  if (grade <= 12) return 'High School';
  if (grade <= 16) return 'College';
  return 'Graduate';
}

function humanDuration(words: number, wpm: number): string {
  const seconds = Math.round((words / wpm) * 60);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function num1(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return (Math.round(n * 10) / 10).toString();
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const showDetails = Boolean(options.showDetails);
  const platform = String(options.platform);
  const text = input.text;

  if (!text) {
    const rows: string[][] = [['Metric', 'Value']];
    return { output: JSON.stringify({ headers: ['Metric', 'Value'], rows }), render: 'table' };
  }

  const counts = analyze(text);
  const { words, sentences, syllables, characters, charactersNoSpaces, paragraphs, lines } = counts;

  // Basic stats
  const wordCount = words;
  const uniqueWords = new Set(
    tokenize(text).map(w => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
  ).size;

  let longestWord = '';
  let totalWordLength = 0;
  for (const w of tokenize(text)) {
    totalWordLength += w.length;
    if (w.length > longestWord.length) longestWord = w;
  }
  const avgWordLength = wordCount ? totalWordLength / wordCount : 0;
  const avgSentenceLength = sentences ? wordCount / sentences : 0;

  // Reading/speaking time
  const readingTime = humanDuration(wordCount, READING_WPM);
  const speakingTime = humanDuration(wordCount, SPEAKING_WPM);

  // Readability scores
  let fleschEase = 0;
  let fleschKincaid = 0;
  let gunningFog = 0;
  let smog = 0;
  let ari = 0;
  let colemanLiau = 0;
  let approximate = false;

  if (words >= 100 && sentences > 0) {
    const wordsPerSentence = wordCount / sentences;
    const syllablesPerWord = syllables / wordCount;

    fleschEase = round(206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord, 1);
    fleschKincaid = round(0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59, 1);
    gunningFog = round(0.4 * (wordsPerSentence + 100 * (syllables >= 3 ? 1 : 0) / wordCount), 1);
    // Simplified SMOG: 1.043 * sqrt(polysyllables * 30/sentences) + 3.1291
    const polysyllables = tokenize(text).filter(w => countSyllables(w) >= 3).length;
    smog = round(1.043 * Math.sqrt(polysyllables * (30 / sentences)) + 3.1291, 1);
    ari = round(4.71 * (characters / wordCount) + 0.5 * (wordCount / sentences) - 21.43, 1);
    colemanLiau = round(0.0588 * (characters / wordCount * 100) - 0.296 * (sentences / wordCount * 100) - 15.8, 1);
  } else {
    approximate = true;
  }

  // Platform limits
  const platformRows: string[][] = [];
  const platformsToShow = platform === 'all' ? Object.keys(PLATFORM_LIMITS) : [platform];
  for (const key of platformsToShow) {
    const p = PLATFORM_LIMITS[key];
    if (!p) continue;
    const used = p.unit === 'chars' ? characters : wordCount;
    const remaining = Math.max(0, p.limit - used);
    const pct = Math.round((used / p.limit) * 100);
    const status = used > p.limit ? '⚠️ OVER' : pct > 90 ? '⚠️ Near limit' : 'OK';
    platformRows.push([p.name, `${used}/${p.limit} ${p.unit}`, `${remaining} remaining`, status]);
  }

  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Characters', characters.toString()],
    ['Characters (no spaces)', charactersNoSpaces.toString()],
    ['Words', wordCount.toString()],
    ['Unique words', uniqueWords.toString()],
    ['Sentences', sentences.toString()],
    ['Paragraphs', paragraphs.toString()],
    ['Lines', lines.toString()],
    ['Reading time', readingTime],
    ['Speaking time', speakingTime],
    ['Average word length', num1(avgWordLength)],
    ['Longest word', longestWord || '(none)'],
    ['Average sentence length (words)', num1(avgSentenceLength)],
  ];

  if (showDetails) {
    rows.push(
      ['', ''],
      ['Readability Scores', ''],
      ['Flesch Reading Ease', `${fleschEase} — ${easeLabel(fleschEase)}`],
      ['Flesch-Kincaid Grade', `${fleschKincaid} — ${gradeLabel(fleschKincaid)}`],
      ['Gunning Fog Index', `${gunningFog} — ${gradeLabel(gunningFog)}`],
      ['SMOG Index', `${smog} — ${gradeLabel(smog)}`],
      ['Automated Readability Index (ARI)', `${ari} — ${gradeLabel(ari)}`],
      ['Coleman-Liau Index', `${colemanLiau} — ${gradeLabel(colemanLiau)}`],
    );
    if (approximate) {
      rows.push(['⚠ Note', 'Scores approximate — text under 100 words or no sentences.']);
    }
    rows.push(['', '']);
    rows.push(['Platform Limits', '']);
    rows.push(['Platform', 'Used / Limit', 'Remaining', 'Status']);
    for (const pr of platformRows) rows.push(pr);
  }

  const output = JSON.stringify({ headers: ['Metric', 'Value'], rows });
  return {
    output,
    render: 'table',
    stats: {
      'words': wordCount,
      'characters': characters,
      'flesch-ease': fleschEase,
      'flesch-kincaid': fleschKincaid,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;