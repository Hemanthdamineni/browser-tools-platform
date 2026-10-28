import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'pomodoro-timer',
  name: 'Pomodoro Timer Planner',
  category: 'datetime',
  summary:
    'Plan a Pomodoro session: work/break cycle lengths, cycle count and transition notifications.',
  description:
    'Lay out a full Pomodoro session before you start. Configure the work and break lengths, how many cycles to run and when the long break kicks in — the planner shows every phase with its clock offsets and the notification you will get at each transition.',
  keywords: [
    'pomodoro',
    'pomodoro timer',
    'tomato timer',
    'focus timer',
    'work break cycle',
    'time management',
    'productivity timer',
    'study timer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'workMinutes',
      label: 'Work length (minutes)',
      type: 'number',
      default: 25,
      min: 1,
      help: 'Length of one focused work phase.',
    },
    {
      key: 'breakMinutes',
      label: 'Short break (minutes)',
      type: 'number',
      default: 5,
      min: 1,
      help: 'Length of the break between two work phases.',
    },
    {
      key: 'longBreakMinutes',
      label: 'Long break (minutes)',
      type: 'number',
      default: 15,
      min: 1,
      help: 'Length of the extended break taken after a full set of work phases.',
    },
    {
      key: 'longBreakEvery',
      label: 'Long break every N work phases',
      type: 'number',
      default: 4,
      min: 1,
      help: 'After this many work phases, take the long break instead of a short one.',
    },
    {
      key: 'cycles',
      label: 'Work phases in the session',
      type: 'number',
      default: 4,
      min: 1,
      help: 'Total number of work phases to plan.',
    },
  ],
  examples: [
    {
      title: 'Classic Pomodoro',
      input: '',
      options: {
        workMinutes: 25,
        breakMinutes: 5,
        longBreakMinutes: 15,
        longBreakEvery: 4,
        cycles: 4,
      },
    },
    {
      title: '52/17 rhythm',
      input: '',
      options: { workMinutes: 52, breakMinutes: 17, longBreakEvery: 3, cycles: 6 },
    },
  ],
  faq: [
    {
      q: 'Does a long break replace the short break?',
      a: 'Yes. After every N work phases the short break is replaced by the long one; all other gaps stay short.',
    },
    {
      q: 'Is there a break after the last work phase?',
      a: 'No — the session ends when the final work phase ends, so nothing is scheduled past your last pomodoro.',
    },
  ],
  related: [  "duration-convert",
  "timestamp",
  "week-number"],
  status: 'stable',
};
