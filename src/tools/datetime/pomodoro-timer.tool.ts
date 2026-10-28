import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pomodoro-timer.meta';
import {
  buildSchedule,
  summarize,
  formatMinutes,
  formatClock,
  validateConfig,
  type PomodoroConfig,
} from './pomodoro-timer.core';

function readNumber(
  o: Record<string, string | number | boolean>,
  key: string,
  fallback: number,
): number {
  const v = o[key];
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

function configFromOptions(o: Record<string, string | number | boolean>): PomodoroConfig {
  return validateConfig({
    workMinutes: readNumber(o, 'workMinutes', 25),
    breakMinutes: readNumber(o, 'breakMinutes', 5),
    longBreakMinutes: readNumber(o, 'longBreakMinutes', 15),
    longBreakEvery: readNumber(o, 'longBreakEvery', 4),
    cycles: readNumber(o, 'cycles', 4),
  });
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const cfg = configFromOptions(o);
  const schedule = buildSchedule(cfg);
  const summary = summarize(schedule);

  const headers = ['#', 'Phase', 'Start', 'Length', 'End', 'Notification'];
  const rows = schedule.map((p) => [
    String(p.index),
    p.kind === 'work' ? `Work ${p.workNumber}` : p.label,
    formatClock(p.startMinute),
    formatMinutes(p.minutes),
    formatClock(p.startMinute + p.minutes),
    p.notification,
  ]);

  const warnings: string[] = [];
  if (cfg.longBreakMinutes <= cfg.breakMinutes) {
    warnings.push(
      `Long break (${formatMinutes(cfg.longBreakMinutes)}) is not longer than the short break (${formatMinutes(cfg.breakMinutes)}).`,
    );
  }

  const text = input.text.trim();
  if (text) {
    // Optional note echoed back as a schedule title (pure text passthrough).
    rows.unshift(['—', `Session: ${text}`, '', '', '', '']);
  }

  const output = JSON.stringify({ headers, rows });

  return {
    output,
    render: 'table',
    notes: [
      `${cfg.cycles} work phase${cfg.cycles === 1 ? '' : 's'} of ${formatMinutes(cfg.workMinutes)} with ` +
        `${summary.shortBreaks} short and ${summary.longBreaks} long break${summary.longBreaks === 1 ? '' : 's'}.`,
      `Total session length: ${formatMinutes(summary.totalMinutes)} ` +
        `(${formatMinutes(summary.totalWorkMinutes)} work + ${formatMinutes(summary.totalBreakMinutes)} breaks).`,
    ],
    warnings,
    stats: {
      'Work phases': cfg.cycles,
      'Total time': formatMinutes(summary.totalMinutes),
      'Focus time': formatMinutes(summary.totalWorkMinutes),
      'Break time': formatMinutes(summary.totalBreakMinutes),
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
