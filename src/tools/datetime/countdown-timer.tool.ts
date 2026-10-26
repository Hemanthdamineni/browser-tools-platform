import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  formatDurationWords,
  formatTimerRow,
  orderTimers,
  parseSnapshot,
} from '@/components/panels/countdown-timer-panel';
import { meta } from './countdown-timer.meta';

/**
 * The countdown timer report.
 *
 * The timers themselves are a live, interactive panel
 * (`src/components/panels/countdown-timer-panel.ts`): it keeps several timers
 * running at once, drives each from an absolute deadline so a sleeping tab
 * still finishes on time, and raises a beep and a notification when one ends.
 * This module is the part that runs through the normal tool contract — it turns
 * a snapshot of the panel's timers into a readable table. Keeping it pure means
 * the report is testable without a DOM, and the tool still works if it is ever
 * called on its own.
 */
function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const { timers, now } = parseSnapshot(input.text);
  const inWords = o.format === 'words';

  const ordered = orderTimers(timers);
  const rows = ordered.map((timer) => {
    const row = formatTimerRow(timer);
    if (!inWords) return row;
    return [
      row[0] ?? '',
      formatDurationWords(timer.durationMs),
      formatDurationWords(timer.remainingMs),
      row[3] ?? '',
    ];
  });

  const running = timers.filter((t) => t.running).length;
  const paused = timers.filter((t) => !t.fired && !t.running).length;
  const finished = timers.filter((t) => t.fired).length;
  // The note follows the table's order, so the two always agree.
  const finishedLabels = ordered.filter((timer) => timer.fired).map((timer) => timer.label);

  const notes: string[] = [
    'Remaining times are read from each timer’s own deadline, so they stay right even if the tab slept.',
  ];
  if (finishedLabels.length) notes.push(`Finished: ${finishedLabels.join(', ')}.`);
  if (o.sound !== false) notes.push('Sound alerts are on.');
  if (o.notify === true) notes.push('Desktop notifications are on.');

  return {
    output: JSON.stringify({ headers: ['Timer', 'Set', 'Remaining', 'State'], rows }),
    render: 'table',
    stats: {
      timers: timers.length,
      running,
      paused,
      finished,
      snapshot: new Date(now).toISOString(),
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
