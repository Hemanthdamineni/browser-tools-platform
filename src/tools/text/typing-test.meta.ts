import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'typing-test',
  name: 'Typing Test',
  category: 'text',
  summary: 'Measure your typing speed (WPM) and accuracy with configurable time modes and local history.',
  description:
    'Test your typing speed with a real-time WPM and accuracy tracker. Choose from 15, 30, 60, or 120 second time modes, or a custom duration. The test generates randomized English word sequences. Results include gross WPM, net WPM, accuracy percentage, and raw/adjusted character counts. History is stored locally in your browser (IndexedDB) and never leaves your device.',
  keywords: [
    'typing test',
    'wpm',
    'words per minute',
    'typing speed',
    'typing accuracy',
    'keyboarding test',
    'typing practice',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Test mode',
      type: 'select',
      default: 'time-60',
      choices: [
        { value: 'time-15', label: '15 seconds' },
        { value: 'time-30', label: '30 seconds' },
        { value: 'time-60', label: '60 seconds' },
        { value: 'time-120', label: '120 seconds' },
        { value: 'words-10', label: '10 words' },
        { value: 'words-25', label: '25 words' },
        { value: 'words-50', label: '50 words' },
      ],
    },
    {
      key: 'punctuation',
      label: 'Include punctuation',
      type: 'boolean',
      default: false,
    },
    {
      key: 'numbers',
      label: 'Include numbers',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { title: 'Standard 60-second test', options: { mode: 'time-60' } },
    { title: 'Quick 15-second burst', options: { mode: 'time-15' } },
    { title: '50-word challenge', options: { mode: 'words-50' } },
  ],
  faq: [
    {
      q: 'How is WPM calculated?',
      a: 'Gross WPM = (total keystrokes / 5) / minutes. Net WPM = (correct keystrokes / 5) / minutes. The standard "word" is defined as 5 keystrokes including spaces.',
    },
    {
      q: 'What is the difference between gross and net WPM?',
      a: 'Gross WPM counts all keystrokes. Net WPM only counts correctly typed characters, so errors reduce your net score.',
    },
    {
      q: 'Where is my history stored?',
      a: 'In your browser\'s IndexedDB under the "typing-test-history" store. It never leaves your device and is not synced anywhere.',
    },
    {
      q: 'Can I use my own text?',
      a: 'This tool generates randomized word sequences. For custom text, use a dedicated "custom text" typing tool (not yet implemented).',
    },
  ],
  related: ['text-stats', 'word-frequency', 'case-convert'],
  status: 'stable',
};