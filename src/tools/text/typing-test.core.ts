/**
 * The typing test's core logic — the parts that are pure and unit-testable
 * without a DOM.
 *
 * The interactive run lives in the panel (`src/components/panels/typing-test.astro`
 * + `typing-test-panel.ts`), which records every keystroke and the target text.
 * This module owns the maths the panel and the tool share: a seeded word
 * sampler (so the same seed always yields the same words), the standard
 * typing-test metrics (net WPM, raw WPM, accuracy, consistency) and the local
 * history helpers. History is stored in `localStorage` only; nothing leaves
 * the device.
 */

/** How long a time-mode countdown lasts by default, in milliseconds. */
export const DEFAULT_TIME_MS = 30000;
/** How many words the sampler draws for a time-mode run. */
export const TIME_MODE_WORDS = 60;
/** Time-window length used for the consistency estimate, in milliseconds. */
export const CONSISTENCY_WINDOW_MS = 5000;
/** The `localStorage` key the result history is kept under. */
export const HISTORY_KEY = 'typing-test:history';
/** How many of the most recent results the history keeps. */
export const HISTORY_CAP = 20;
/** A "word" is five characters — the standard typing-test unit. */
const CHARS_PER_WORD = 5;

/**
 * A few hundred of the most common English words, embedded so the test works
 * fully offline. Used by the seeded sampler; keeping them in one flat string
 * keeps the bundle tiny.
 */
const WORD_BANK =
  'the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been has had having above again against almost along already although always among another any anybody anyone anything anywhere area areas around ask asked asking asks away backed backing backs became become becomes before began begin beginning begun behind being believe believed believes below beside best better between big both but by came cannot case cases certain certainly clear clearly come could country course days did didn different do does doing don done down during each early either end ended ending ends enough even ever every everybody everyone everything everywhere exactly example examples face fact facts far few fewer figure figures find finds first five follow followed following four from full fully further get gets getting give given gives go going gone good great group groups had hadn happens happy has hasn have haven having he her here hers herself hi high higher highest him himself his how however hundreds if important in include included includes including into is isn it its itself just keep keeps kept kind know knows known large last later least less let lets life like likely long longer longest look looks made make makes making man many may me member members men might more most mostly much must my myself name names near need needs never new next no none nor not nothing now numbers of off often old on once one ones only or other others our ours ourselves out over own part parts per perhaps person persons place places point points possible present presented presents problem problems put puts question questions quick quickly quite rather really right room rooms said same say says see seem seemed seems seen several shall she should show showed showing shows side sides since small smaller smallest so some something sometimes somewhere soon state states still such sure take taken takes tell tells than thank thanks that the their theirs them themselves then there therefore these they thing things think thinks this those though thought thoughts three through throughout thus time times today together too took toward towards try tried tries trying two under until up upon us use used uses using usually very want wants was wasn way ways we well were weren what whatever when where whether which while who whoever whom whose why will with within without won wonder work worked working works would wouldn yes yet you your yours yourself yourselves';

/** The words as an array, so the sampler can index into it. */
const WORDS: string[] = WORD_BANK.split(/\s+/).filter(Boolean);

/** A printable keystroke, as the panel records it. */
export interface KeystrokeRecord {
  /** The character expected at the caret when the key was pressed. */
  expected: string;
  /** The character that was actually typed. */
  typed: string;
  /** Milliseconds since the run started. */
  at: number;
}

/** The metrics the tool reports for one finished run. */
export interface TypingMetrics {
  totalTyped: number;
  correctChars: number;
  errors: number;
  durationMs: number;
  netWpm: number;
  rawWpm: number;
  /** Accuracy as a percentage, 0–100. */
  accuracy: number;
  /** Consistency as a percentage, or null when the run was too short to judge. */
  consistency: number | null;
}

/** One saved result in the local history. */
export interface HistoryEntry {
  /** A short unique id for the row. */
  id: string;
  netWpm: number;
  rawWpm: number;
  accuracy: number;
  /** The mode the run used: 'time' or 'words'. */
  mode: 'time' | 'words';
  /** The number of words in the target text. */
  words: number;
  /** How long the run actually lasted, in milliseconds. */
  durationMs: number;
  /** ISO timestamp of when the run finished. */
  at: string;
}

/** A finished session, serialised and handed to the tool's `run()`. */
export interface TypingSession {
  records: KeystrokeRecord[];
  target: string;
  mode: 'time' | 'words';
  durationMs: number;
  words: number;
}

/**
 * A tiny seeded PRNG (mulberry32) so the same seed always produces the same
 * word sequence — that is what makes the sampler deterministic in tests.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw `count` words from the embedded bank using a seeded PRNG. The result is
 * a flat list of words, ready to be joined with spaces into a typing target.
 */
export function sampleWords(seed: number, count: number): string[] {
  const rand = mulberry32(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(rand() * WORDS.length);
    out.push(WORDS[index]!);
  }
  return out;
}

/** Join sampled words into the text the user types (space separated). */
export function buildTarget(seed: number, count: number): string {
  return sampleWords(seed, count).join(' ');
}

/**
 * Compute the standard typing-test metrics from a keystroke record.
 *
 * - Net WPM: (correct characters / 5) per minute.
 * - Raw WPM: (all characters typed / 5) per minute.
 * - Accuracy: correct characters as a percentage of every character typed.
 * - Consistency: 100 minus the coefficient of variation of per-window net WPM.
 *   `null` when there are fewer than two populated windows to compare.
 */
export function computeMetrics(records: KeystrokeRecord[], durationMs: number): TypingMetrics {
  const totalTyped = records.length;
  let correctChars = 0;
  for (const record of records) {
    if (record.typed === record.expected) correctChars += 1;
  }
  const errors = totalTyped - correctChars;

  const minutes = Math.max(durationMs, 1) / 60000;
  const netWpm = correctChars / CHARS_PER_WORD / minutes;
  const rawWpm = totalTyped / CHARS_PER_WORD / minutes;
  const accuracy = totalTyped > 0 ? (correctChars / totalTyped) * 100 : 0;

  return {
    totalTyped,
    correctChars,
    errors,
    durationMs,
    netWpm,
    rawWpm,
    accuracy,
    consistency: estimateConsistency(records),
  };
}

/**
 * A simple consistency score: split the run into fixed time windows, work out
 * the net WPM of each window that saw any typing, and report 100 minus the
 * coefficient of variation of those rates. A steady pace scores close to 100;
 * a stop-start run scores far lower once at least two windows have data.
 */
function estimateConsistency(records: KeystrokeRecord[]): number | null {
  const windowCounts = new Map<number, number>();
  for (const record of records) {
    const bucket = Math.floor(record.at / CONSISTENCY_WINDOW_MS);
    const current = windowCounts.get(bucket) ?? 0;
    windowCounts.set(bucket, current + (record.typed === record.expected ? 1 : 0));
  }

  const rates: number[] = [];
  const windowMinutes = CONSISTENCY_WINDOW_MS / 60000;
  for (const count of windowCounts.values()) {
    if (count <= 0) continue;
    rates.push(count / CHARS_PER_WORD / windowMinutes);
  }
  if (rates.length < 2) return null;

  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  if (mean <= 0) return null;
  const variance =
    rates.reduce((sum, rate) => sum + (rate - mean) * (rate - mean), 0) / rates.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, 100 - cv * 100));
}

/* -------------------------------------------------------------------------- */
/*  Local history (localStorage only)                                          */
/* -------------------------------------------------------------------------- */

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.netWpm === 'number' &&
    typeof entry.rawWpm === 'number' &&
    typeof entry.accuracy === 'number' &&
    (entry.mode === 'time' || entry.mode === 'words') &&
    typeof entry.words === 'number' &&
    typeof entry.durationMs === 'number' &&
    typeof entry.at === 'string'
  );
}

/** Read the saved history, newest last, capped at HISTORY_CAP entries. */
export function readHistory(storage: Storage): HistoryEntry[] {
  let raw: string | null = null;
  try {
    raw = storage.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).slice(-HISTORY_CAP);
  } catch {
    return [];
  }
}

/** Append a result and return the full history (capped). */
export function appendHistory(storage: Storage, entry: HistoryEntry): HistoryEntry[] {
  const next = [...readHistory(storage), entry];
  while (next.length > HISTORY_CAP) next.shift();
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — the run still completes */
  }
  return next;
}

/** Clear every saved result. */
export function clearHistory(storage: Storage): void {
  try {
    storage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}