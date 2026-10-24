import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-repeat',
  name: 'Repeat Text',
  category: 'text',
  summary:
    'Repeat the input a set number of times, joined by a newline, space, comma, or custom separator.',
  description:
    'Duplicate a string as many times as you like and join the copies with the separator of your choice. The result is capped at five million characters.',
  keywords: [
    'repeat text',
    'duplicate text',
    'repeat string',
    'multiply text',
    'text repeater',
    'loop text',
    'copy text n times',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'count',
      label: 'Number of copies',
      type: 'number',
      default: 10,
      min: 1,
      max: 100000,
      step: 1,
    },
    {
      key: 'separator',
      label: 'Separator between copies',
      type: 'select',
      default: 'newline',
      choices: [
        { value: 'newline', label: 'Newline' },
        { value: 'space', label: 'Space' },
        { value: 'comma', label: 'Comma' },
        { value: 'none', label: 'None (join directly)' },
        { value: 'custom', label: 'Custom…' },
      ],
    },
    {
      key: 'custom',
      label: 'Custom separator',
      type: 'text',
      default: '',
      placeholder: 'e.g. " | "',
      showWhen: { key: 'separator', value: 'custom' },
    },
  ],
  article: [
    {
      heading: 'What Repeat Text produces',
      body: 'Repeat Text writes a piece of text out a chosen number of times, joined by a separator you pick. You set a copy count from 1 to 100000, and the separator goes between copies only, never at the start or the end. The result also reports the copy count and the total character length.',
    },
    {
      heading: 'When a repeated string saves time',
      body: 'Reach for it for repeated test data, a filled placeholder, N identical lines for a file you are about to generate, or a comma-joined series of the same value built in one step instead of typed out by hand.',
    },
    {
      heading: 'Choosing the copy count and separator',
      body: 'Count sets how many copies appear and is clamped to 100000 even if a larger number is typed. Separator offers newline, space, comma, none, or custom; custom reveals a text field whose literal string is inserted verbatim, so multi-character joins like " | " work.',
    },
    {
      heading: 'The five-million-character ceiling',
      body: 'The result is capped at five million characters. The tool predicts the length before building it and refuses with a clear message if that passes the limit. Counts below 1 are rejected, and an empty input simply gives an empty output.',
    },
    {
      heading: 'Where the text is processed',
      body: 'Everything happens on your device. The text is repeated in memory in the browser, no part of it is sent to a server, and the tool works offline with no network requests.',
    },
  ],
  examples: [
    { title: 'Repeat "ab" 3× directly', input: 'ab', options: { count: 3, separator: 'none' } },
    { title: 'Comma-separated', input: 'x', options: { count: 5, separator: 'comma' } },
    {
      title: 'Custom separator',
      input: 'na',
      options: { count: 8, separator: 'custom', custom: ' ' },
    },
  ],
  faq: [
    {
      q: 'Is there a size limit?',
      a: 'Yes — the output is capped at 5,000,000 characters. If you exceed it, reduce the number of copies.',
    },
    {
      q: 'Can the separator be more than one character?',
      a: 'Yes. Choose "Custom…" and type any literal string, including spaces. It is inserted verbatim between copies, not before the first or after the last.',
    },
    {
      q: 'What happens with an empty input?',
      a: 'The output is empty. There is nothing to repeat, so the result is an empty string regardless of the count.',
    },
  ],
  related: ['reverse-text', 'case-convert', 'sort-lines', 'dedupe-lines'],
  status: 'stable',
};
