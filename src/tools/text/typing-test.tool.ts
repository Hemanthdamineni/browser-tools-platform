import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './typing-test.meta';

const WORD_LIST = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'each', 'which',
  'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out',
  'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like',
  'him', 'into', 'time', 'has', 'look', 'two', 'more', 'write', 'go', 'see',
  'number', 'no', 'way', 'could', 'people', 'my', 'than', 'first', 'water', 'been',
  'call', 'who', 'oil', 'its', 'now', 'find', 'long', 'down', 'day', 'did',
  'get', 'come', 'made', 'may', 'part', 'over', 'new', 'sound', 'take', 'only',
  'little', 'work', 'know', 'place', 'year', 'live', 'me', 'back', 'give', 'most',
  'very', 'after', 'thing', 'our', 'just', 'name', 'good', 'sentence', 'man', 'think',
  'say', 'great', 'where', 'help', 'through', 'much', 'before', 'line', 'right', 'too',
  'mean', 'old', 'any', 'same', 'tell', 'boy', 'follow', 'came', 'want', 'show',
  'also', 'around', 'form', 'three', 'small', 'set', 'put', 'end', 'does', 'another',
  'well', 'large', 'must', 'big', 'even', 'such', 'because', 'turn', 'here', 'why',
  'ask', 'went', 'men', 'read', 'need', 'land', 'different', 'home', 'us', 'move',
  'try', 'kind', 'hand', 'picture', 'again', 'change', 'off', 'play', 'spell', 'air',
  'away', 'animal', 'house', 'point', 'page', 'letter', 'mother', 'answer', 'found', 'study',
  'still', 'learn', 'should', 'america', 'world', 'high', 'every', 'near', 'add', 'food',
  'between', 'own', 'below', 'country', 'plant', 'last', 'school', 'father', 'keep', 'tree',
  'never', 'start', 'city', 'earth', 'eye', 'light', 'thought', 'head', 'under', 'story',
  'saw', 'left', 'don', 'few', 'while', 'along', 'might', 'close', 'something', 'seem',
  'next', 'hard', 'open', 'example', 'begin', 'life', 'always', 'those', 'both', 'paper',
  'together', 'got', 'group', 'often', 'run', 'important', 'until', 'children', 'side', 'feet',
  'car', 'mile', 'night', 'walk', 'white', 'sea', 'began', 'grow', 'took', 'river',
  'four', 'carry', 'state', 'once', 'book', 'hear', 'stop', 'without', 'second', 'later',
  'miss', 'idea', 'enough', 'eat', 'face', 'watch', 'far', 'indian', 'really', 'almost',
  'let', 'above', 'girl', 'sometimes', 'mountain', 'cut', 'young', 'talk', 'soon', 'list',
  'song', 'being', 'leave', 'family', 'it', 'body', 'music', 'color', 'stand', 'sun',
  'questions', 'fish', 'area', 'mark', 'dog', 'horse', 'birds', 'problem', 'complete', 'room',
  'knew', 'since', 'ever', 'piece', 'told', 'usually', 'didn', 'friends', 'easy', 'heard',
  'order', 'red', 'door', 'sure', 'become', 'top', 'ship', 'across', 'today', 'during',
  'short', 'better', 'best', 'however', 'low', 'hours', 'black', 'products', 'happened', 'whole',
  'measure', 'remember', 'early', 'waves', 'reached', 'listen', 'wind', 'rock', 'space', 'covered',
  'fast', 'several', 'hold', 'himself', 'toward', 'five', 'step', 'morning', 'passed', 'vowel',
  'true', 'hundred', 'against', 'pattern', 'numeral', 'table', 'north', 'slowly', 'money', 'map',
  'farm', 'pulled', 'draw', 'voice', 'seen', 'cold', 'cried', 'plan', 'notice', 'south',
  'sing', 'war', 'ground', 'fall', 'king', 'town', 'i', 'unit', 'figure', 'certain',
  'field', 'travel', 'wood', 'fire', 'upon', 'done', 'english', 'road', 'half', 'ten',
  'fly', 'gave', 'box', 'finally', 'wait', 'correct', 'oh', 'quickly', 'person', 'became',
  'shown', 'minutes', 'strong', 'verb', 'stars', 'front', 'feel', 'fact', 'inches', 'street',
  'decided', 'contain', 'course', 'surface', 'produce', 'building', 'ocean', 'class', 'note', 'nothing',
  'rest', 'carefully', 'scientists', 'inside', 'wheels', 'stay', 'green', 'known', 'island', 'week',
  'less', 'machine', 'base', 'ago', 'stood', 'plane', 'system', 'behind', 'ran', 'round',
  'boat', 'game', 'force', 'brought', 'understand', 'warm', 'common', 'bring', 'explain', 'dry',
  'though', 'language', 'shape', 'deep', 'thousands', 'yes', 'clear', 'equation', 'yet', 'government',
  'filled', 'heat', 'full', 'hot', 'check', 'object', 'am', 'rule', 'among', 'noun',
  'power', 'cannot', 'able', 'six', 'size', 'dark', 'ball', 'material', 'special', 'heavy',
  'fine', 'pair', 'circle', 'include', 'built', 'heart', 'one', 'king', 'north', 'south',
];

const PUNCTUATION = ['.', ',', '?', '!', ';', ':'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function shuffleArray<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i]!, copy[j]!] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function generateWords(count: number, includePunctuation: boolean, includeNumbers: boolean): string {
  const pool = [...WORD_LIST];
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const word = pool[Math.floor(Math.random() * pool.length)]!;
    result.push(word);

    if (includePunctuation && Math.random() < 0.1) {
      result.push(PUNCTUATION[Math.floor(Math.random() * PUNCTUATION.length)]!);
    }
    if (includeNumbers && Math.random() < 0.05) {
      result.push(NUMBERS[Math.floor(Math.random() * NUMBERS.length)]!);
    }
  }

  return result.join(' ');
}

function generateTestText(mode: string, includePunctuation: boolean, includeNumbers: boolean): { text: string; targetWords: number; timeLimit: number } {
  if (mode.startsWith('time-')) {
    const seconds = parseInt(mode.replace('time-', ''), 10);
    // Estimate words based on average 40 WPM = ~0.67 words/second
    const targetWords = Math.max(10, Math.floor(seconds * 0.67));
    return { text: generateWords(targetWords * 2, includePunctuation, includeNumbers), targetWords, timeLimit: seconds };
  } else if (mode.startsWith('words-')) {
    const words = parseInt(mode.replace('words-', ''), 10);
    return { text: generateWords(words * 2, includePunctuation, includeNumbers), targetWords: words, timeLimit: 0 };
  }
  return { text: generateWords(50, includePunctuation, includeNumbers), targetWords: 50, timeLimit: 60 };
}

interface TypingResult {
  grossWpm: number;
  netWpm: number;
  accuracy: number;
  correctChars: number;
  totalChars: number;
  errors: number;
  timeElapsed: number;
  completed: boolean;
}

function calculateResults(targetText: string, typedText: string, timeElapsed: number, completed: boolean): TypingResult {
  const targetChars = [...targetText];
  const typedChars = [...typedText];
  
  let correctChars = 0;
  let totalChars = typedChars.length;
  
  for (let i = 0; i < typedChars.length; i++) {
    if (typedChars[i] === targetChars[i]) {
      correctChars++;
    }
  }
  
  const errors = totalChars - correctChars;
  const minutes = timeElapsed / 60;
  
  const grossWpm = minutes > 0 ? Math.round((totalChars / 5) / minutes) : 0;
  const netWpm = minutes > 0 ? Math.round((correctChars / 5) / minutes) : 0;
  const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;
  
  return {
    grossWpm: Math.max(0, grossWpm),
    netWpm: Math.max(0, netWpm),
    accuracy,
    correctChars,
    totalChars,
    errors,
    timeElapsed,
    completed,
  };
}

function formatResults(result: TypingResult, targetText: string, typedText: string): TextRunResult {
  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Gross WPM', result.grossWpm.toString()],
    ['Net WPM', result.netWpm.toString()],
    ['Accuracy', `${result.accuracy}%`],
    ['Correct Characters', result.correctChars.toString()],
    ['Total Characters Typed', result.totalChars.toString()],
    ['Errors', result.errors.toString()],
    ['Time Elapsed', `${result.timeElapsed}s`],
    ['Test Completed', result.completed ? 'Yes' : 'No (time expired)'],
    ['Target Text Length', [...targetText].length.toString()],
  ];

  const output = JSON.stringify({ headers: ['Metric', 'Value'], rows });
  
  return {
    output,
    render: 'table',
    stats: {
      'gross wpm': result.grossWpm,
      'net wpm': result.netWpm,
      'accuracy': result.accuracy,
    },
  };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode ?? 'time-60');
  const includePunctuation = Boolean(options.punctuation);
  const includeNumbers = Boolean(options.numbers);
  // For the tool run, we can only return the target text or a test result
  // The actual interactive test runs in the panel
  const { text: targetText, targetWords, timeLimit } = generateTestText(mode, includePunctuation, includeNumbers);
  
  // If user provided input text, treat it as typed text and calculate results
  if (input.text) {
    // This would need the start time - we'll estimate from text length
    // In real usage, the panel handles timing
    const timeElapsed = Math.max(1, Math.round(input.text.length / 5 / 40 * 60)); // rough estimate
    const result = calculateResults(targetText, input.text, timeElapsed, input.text.length >= targetText.length);
    return formatResults(result, targetText, input.text);
  }

  // Return the target text for the user to type
  const previewText = targetText.length > 200 ? targetText.slice(0, 200) + '...' : targetText;
  return {
    output: `Target text (${targetWords} words${timeLimit ? `, ${timeLimit}s limit` : ''}):\n\n${previewText}\n\nType in the panel to start the test.`,
    render: 'text',
  };
}

const tool: TextToolModule = { meta, run };
export default tool;