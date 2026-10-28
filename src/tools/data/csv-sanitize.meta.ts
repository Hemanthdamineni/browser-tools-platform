import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-sanitize',
  name: 'CSV Formula Injection Guard',
  category: 'data',
  summary: 'Detect and neutralize spreadsheet formula injection in CSV cells.',
  description:
    'Inspect CSV records for cells that begin with spreadsheet formula triggers and prefix them with a protective apostrophe. Quoted fields, escaped quotes, and multiline fields are parsed before sanitization. Processing stays in your browser.',
  keywords: [
    'csv security',
    'csv sanitize',
    'formula injection',
    'csv injection',
    'spreadsheet injection',
    'excel formula injection',
    'csv escape formulas',
    'owasp csv injection',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      default: 'comma',
      choices: [
        { value: 'comma', label: 'Comma (,)' },
        { value: 'semicolon', label: 'Semicolon (;)' },
        { value: 'tab', label: 'Tab' },
        { value: 'pipe', label: 'Pipe (|)' },
      ],
    },
    {
      key: 'mode',
      label: 'Action',
      type: 'select',
      default: 'sanitize',
      choices: [
        { value: 'sanitize', label: 'Sanitize and return CSV' },
        { value: 'report', label: 'Report risky cells only' },
      ],
    },
    {
      key: 'trimLeadingWhitespace',
      label: 'Detect after leading whitespace and control characters',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Sanitize formula-leading cells',
      input: 'name,comment\nAda,=SUM(A1:A2)\nLinus,+1+1\nGrace,@COUNT(A4:A6)',
    },
    {
      title: 'Inspect risky cells',
      input: 'account,note\n001,"  @SUM(A1:A2)"\n002,safe text',
      options: { mode: 'report' },
    },
  ],
  faq: [
    {
      q: 'What counts as a risky formula?',
      a: 'Cells whose first meaningful character is =, +, - or @ are flagged. Depending on the spreadsheet and import path, leading whitespace or control characters may be ignored, so that detection can be enabled or disabled.',
    },
    {
      q: 'Does adding an apostrophe guarantee safety in every spreadsheet?',
      a: 'No universal mitigation works identically across every spreadsheet and import workflow. The apostrophe is a common mitigation for CSV opened in spreadsheet applications, but review the target application and keep the original data when handling sensitive workflows.',
    },
    {
      q: 'Are quoted commas and multiline fields supported?',
      a: 'Yes. The parser handles quoted delimiters, doubled quotes, CRLF/LF records and newlines inside quoted fields. Malformed quoting is rejected rather than guessed.',
    },
  ],
  related: [  "csv-to-json",
  "json-to-csv",
  "file-metadata"],
  status: 'stable',
};
