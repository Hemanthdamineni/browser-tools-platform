import { describe, expect, it } from 'vitest';
import tool from './mbox-archive-analyzer.tool';
import { meta } from './mbox-archive-analyzer.meta';

const FIXTURES: Record<string, string> = {
  'clean.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <a1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Quarterly numbers\nDate: Mon, 6 Jan 2025 09:12:04 +0000\nStatus: RO\n\nHere are the numbers.\n',
  'sample.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <a1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Quarterly numbers\nDate: Mon, 6 Jan 2025 09:12:04 +0000\nStatus: RO\n\nHere are the numbers.\n\nFrom bob@example.com Tue Jan  7 14:00:00 2025\nMessage-ID: <b1@example.com>\nFrom: Bob <bob@example.com>\nTo: alice@example.com\nSubject: Re: Quarterly numbers\nDate: Tue, 7 Jan 2025 14:00:00 +0000\nX-Status: A\n\nLooks right.\n\nFrom carol@example.com Tue Jan  7 14:05:00 2025\nMessage-ID: <c1@example.com>\nFrom: Carol <carol@example.com>\nTo: team@example.com\nSubject: Meeting notes\nDate: Tue, 7 Jan 2025 14:05:00 +0000\nStatus: R\n\nNotes from today.\n\nFrom alice@example.com Tue Jun  3 08:00:00 2025\nMessage-ID: <a2@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: The report\nDate: Tue, 3 Jun 2025 08:00:00 +0000\nContent-Type: multipart/mixed; boundary="BND"\n\n--BND\nContent-Type: text/plain\n\nThe report is attached.\n--BND\nContent-Type: application/pdf\nContent-Disposition: attachment; filename="report.pdf"\nContent-Transfer-Encoding: base64\n\nSGVsbG8gd29ybGQ=\n--BND--\n\n\n',
  'escaped.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <e1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Quoted prose\nDate: Mon, 6 Jan 2025 09:12:04 +0000\n\n>From the desk of Alice\n>>From a deeper level\n',
  'escape-only.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <e1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Quoted prose\nDate: Mon, 6 Jan 2025 09:12:04 +0000\n\n>From the desk of Alice\n>>From a deeper level\n',
  'nodate.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <n1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: No date here\n\nHello\n',
  'flagsonly.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <f1@example.com>\nTo: bob@example.com\nSubject: Flags only\nStatus: D\nX-Status: A\nDate: Mon, 6 Jan 2025 09:12:04 +0000\n\nBody\n',
  'duplicate.mbox':
    'From a@example.com Mon Jan  6 09:00:00 2025\nMessage-ID: <dup@example.com>\nFrom: A <a@example.com>\nTo: b@example.com\nSubject: One\nDate: Mon, 6 Jan 2025 09:00:00 +0000\n\nFirst\n\nFrom b@example.com Mon Jan  6 10:00:00 2025\nMessage-ID: <b@example.com>\nFrom: B <b@example.com>\nTo: a@example.com\nSubject: Two\nDate: Mon, 6 Jan 2025 10:00:00 +0000\n\nSecond\n\nFrom c@example.com Mon Jan  6 11:00:00 2025\nMessage-ID: <dup@example.com>\nFrom: C <c@example.com>\nTo: b@example.com\nSubject: Three\nDate: Mon, 6 Jan 2025 11:00:00 +0000\n\nThird\n',
  'dangling.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <d1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Reply\nDate: Mon, 6 Jan 2025 09:12:04 +0000\nIn-Reply-To: <parent@nowhere>\n\nRe: your earlier mail\n',
  'badbase64.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <bb1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Attachment\nDate: Mon, 6 Jan 2025 09:12:04 +0000\nContent-Type: multipart/mixed; boundary="BND"\n--BND\nContent-Type: text/plain\n\nSee the file.\n--BND\nContent-Type: application/octet-stream\nContent-Disposition: attachment; filename="data.bin"\nContent-Transfer-Encoding: base64\n\nSGVsbG8=not-base64!\n--BND--\n\n \n',
  'brokenmime.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <bm1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Broken multipart\nDate: Mon, 6 Jan 2025 09:12:04 +0000\nContent-Type: multipart/mixed; boundary="NOPE"\n\nThis boundary never appears.\n',
  'noblank.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <nb1@example.com>\nFrom: Alice <alice@example.com>\nSubject: No blank line\nDate: Mon, 6 Jan 2025 09:12:04 +0000\nheaders flow into body without a blank line\n',
  'noheaders.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\njust a body line, no headers at all\n\n',
  'fragile.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\nMessage-ID: <fr1@example.com>\nFrom: Alice <alice@example.com>\nTo: bob@example.com\nSubject: Fragile\nDate: Mon, 6 Jan 2025 09:12:04 +0000\n\nSee below.\nFrom the desk of Bob\nRegards, Bob\n',
  'crlf.mbox':
    'From alice@example.com Mon Jan  6 09:12:04 2025\r\nMessage-ID: <cr1@example.com>\r\nFrom: Alice <alice@example.com>\r\nTo: bob@example.com\r\nSubject: CRLF one\r\nDate: Mon, 6 Jan 2025 09:12:04 +0000\r\n\r\nFirst body.\r\n\r\nFrom bob@example.com Mon Jan  6 10:12:04 2025\r\nMessage-ID: <cr2@example.com>\r\nFrom: Bob <bob@example.com>\r\nTo: alice@example.com\r\nSubject: CRLF two\r\nDate: Mon, 6 Jan 2025 10:12:04 +0000\r\n\r\nSecond body.\r\n',
};

interface Oracle {
  count: number;
  sizes: string[];
  froms: string[];
  envelopes: string[];
  dates: string[];
  subjects: string[];
  mids: string[];
  attachmentCounts: number[];
  attachmentSizes: string[];
  flags: string[];
}

const ORACLE: Record<string, Oracle> = {
  'clean.mbox': {
    count: 1,
    sizes: ['179 B'],
    froms: ['Alice <alice@example.com>'],
    envelopes: ['alice@example.com'],
    dates: ['2025-01-06 09:12'],
    subjects: ['Quarterly numbers'],
    mids: ['<a1@example.com>'],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: ['RO'],
  },
  'sample.mbox': {
    count: 4,
    sizes: ['179 B', '173 B', '171 B', '393 B'],
    froms: [
      'Alice <alice@example.com>',
      'Bob <bob@example.com>',
      'Carol <carol@example.com>',
      'Alice <alice@example.com>',
    ],
    envelopes: ['alice@example.com', 'bob@example.com', 'carol@example.com', 'alice@example.com'],
    dates: ['2025-01-06 09:12', '2025-01-07 14:00', '2025-01-07 14:05', '2025-06-03 08:00'],
    subjects: ['Quarterly numbers', 'Re: Quarterly numbers', 'Meeting notes', 'The report'],
    mids: ['<a1@example.com>', '<b1@example.com>', '<c1@example.com>', '<a2@example.com>'],
    attachmentCounts: [0, 0, 0, 1],
    attachmentSizes: ['11 B'],
    flags: ['RO', 'A', 'R', ''],
  },
  'escaped.mbox': {
    count: 1,
    sizes: ['187 B'],
    froms: ['Alice <alice@example.com>'],
    envelopes: ['alice@example.com'],
    dates: ['2025-01-06 09:12'],
    subjects: ['Quoted prose'],
    mids: ['<e1@example.com>'],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: [''],
  },
  'escape-only.mbox': {
    count: 1,
    sizes: ['187 B'],
    froms: ['Alice <alice@example.com>'],
    envelopes: ['alice@example.com'],
    dates: ['2025-01-06 09:12'],
    subjects: ['Quoted prose'],
    mids: ['<e1@example.com>'],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: [''],
  },
  'nodate.mbox': {
    count: 1,
    sizes: ['110 B'],
    froms: ['Alice <alice@example.com>'],
    envelopes: ['alice@example.com'],
    dates: [''],
    subjects: ['No date here'],
    mids: ['<n1@example.com>'],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: [''],
  },
  'flagsonly.mbox': {
    count: 1,
    sizes: ['134 B'],
    froms: [''],
    envelopes: ['alice@example.com'],
    dates: ['2025-01-06 09:12'],
    subjects: ['Flags only'],
    mids: ['<f1@example.com>'],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: ['DA'],
  },
  'duplicate.mbox': {
    count: 3,
    sizes: ['129 B', '128 B', '131 B'],
    froms: ['A <a@example.com>', 'B <b@example.com>', 'C <c@example.com>'],
    envelopes: ['a@example.com', 'b@example.com', 'c@example.com'],
    dates: ['2025-01-06 09:00', '2025-01-06 10:00', '2025-01-06 11:00'],
    subjects: ['One', 'Two', 'Three'],
    mids: ['<dup@example.com>', '<b@example.com>', '<dup@example.com>'],
    attachmentCounts: [0, 0, 0],
    attachmentSizes: [],
    flags: ['', '', ''],
  },
  'dangling.mbox': {
    count: 1,
    sizes: ['186 B'],
    froms: ['Alice <alice@example.com>'],
    envelopes: ['alice@example.com'],
    dates: ['2025-01-06 09:12'],
    subjects: ['Reply'],
    mids: ['<d1@example.com>'],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: [''],
  },
  'badbase64.mbox': {
    count: 1,
    sizes: ['395 B'],
    froms: ['Alice <alice@example.com>'],
    envelopes: ['alice@example.com'],
    dates: ['2025-01-06 09:12'],
    subjects: ['Attachment'],
    mids: ['<bb1@example.com>'],
    attachmentCounts: [1],
    attachmentSizes: ['12 B'],
    flags: [''],
  },
  'brokenmime.mbox': {
    count: 1,
    sizes: ['222 B'],
    froms: ['Alice <alice@example.com>'],
    envelopes: ['alice@example.com'],
    dates: ['2025-01-06 09:12'],
    subjects: ['Broken multipart'],
    mids: ['<bm1@example.com>'],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: [''],
  },
  'noblank.mbox': {
    count: 1,
    sizes: ['166 B'],
    froms: ['Alice <alice@example.com>'],
    envelopes: ['alice@example.com'],
    dates: ['2025-01-06 09:12'],
    subjects: ['No blank line'],
    mids: ['<nb1@example.com>'],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: [''],
  },
  'noheaders.mbox': {
    count: 1,
    sizes: ['36 B'],
    froms: [''],
    envelopes: ['alice@example.com'],
    dates: [''],
    subjects: [''],
    mids: [''],
    attachmentCounts: [0],
    attachmentSizes: [],
    flags: [''],
  },
  'fragile.mbox': {
    count: 2,
    sizes: ['148 B', '13 B'],
    froms: ['Alice <alice@example.com>', ''],
    envelopes: ['alice@example.com', 'the'],
    dates: ['2025-01-06 09:12', ''],
    subjects: ['Fragile', ''],
    mids: ['<fr1@example.com>', ''],
    attachmentCounts: [0, 0],
    attachmentSizes: [],
    flags: ['', ''],
  },
  'crlf.mbox': {
    count: 2,
    sizes: ['159 B', '156 B'],
    froms: ['Alice <alice@example.com>', 'Bob <bob@example.com>'],
    envelopes: ['alice@example.com', 'bob@example.com'],
    dates: ['2025-01-06 09:12', '2025-01-06 10:12'],
    subjects: ['CRLF one', 'CRLF two'],
    mids: ['<cr1@example.com>', '<cr2@example.com>'],
    attachmentCounts: [0, 0],
    attachmentSizes: [],
    flags: ['', ''],
  },
};

const asFile = (name: string): File =>
  new File([FIXTURES[name] ?? ''], name, { type: 'application/octet-stream' });

interface Result {
  outputs: string[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
}

const run = (name: string, format: string, extra: Record<string, unknown> = {}): Promise<Result> =>
  tool.run({
    files: [asFile(name)],
    options: { format, top: 10, ...extra },
  }) as unknown as Promise<Result>;

const table = (result: Result): { headers: string[]; rows: string[][] } =>
  JSON.parse(result.report?.output ?? '{"headers":[],"rows":[]}') as {
    headers: string[];
    rows: string[][];
  };
const map = (result: Result): Map<string, string> =>
  new Map(table(result).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
const rows = (result: Result): string[][] => table(result).rows;

describe('mbox-archive-analyzer metadata', () => {
  it('describes a file tool that accepts pasted text and stays on device', () => {
    expect(meta.id).toBe('mbox-archive-analyzer');
    expect(meta.category).toBe('data');
    expect(meta.input).toBe('file');
    expect(meta.acceptsText).toBe(true);
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
    expect((meta.options ?? []).map((option) => option.key)).toEqual(['format', 'top']);
  });
});

describe('parity with Python mailbox (independent oracle)', () => {
  it('finds the same number of messages Python finds', async () => {
    for (const [name, oracle] of Object.entries(ORACLE)) {
      const result = await run(name, 'summary');
      expect([name, result.stats?.messages]).toEqual([name, oracle.count]);
    }
  });

  it('computes the same per-message byte counts as Python', async () => {
    // Python's mailbox.get_bytes() returns the raw slice between the From_ line and the next
    // separator; the test formats its byte count with the tool's own documented size rule.
    for (const [name, oracle] of Object.entries(ORACLE)) {
      const sizes = table(await run(name, 'messages')).rows.map((row) => row[5] ?? '');
      expect([name, sizes]).toEqual([name, oracle.sizes]);
    }
  });

  it('agrees with Python about which messages carry status flags', async () => {
    for (const [name, oracle] of Object.entries(ORACLE)) {
      const flags = table(await run(name, 'messages')).rows.map((row) => row[7] ?? '');
      expect([name, flags.map((value) => value !== '-')]).toEqual([
        name,
        oracle.flags.map((value) => value !== ''),
      ]);
    }
  });

  it('reads the same From headers, dates and subjects Python reads', async () => {
    for (const [name, oracle] of Object.entries(ORACLE)) {
      const result = await run(name, 'messages');
      const rows = table(result).rows;
      // A missing From header falls back to the address on the From_ separator line.
      expect([name, rows.map((row) => row[1] ?? '')]).toEqual([
        name,
        oracle.froms.map((value, index) =>
          value === '' ? (oracle.envelopes[index] ?? '') : value,
        ),
      ]);
      expect([name, rows.map((row) => row[4] ?? '')]).toEqual([
        name,
        oracle.subjects.map((value) => (value === '' ? '(no subject)' : value)),
      ]);
      for (let index = 0; index < oracle.dates.length; index += 1) {
        const date = rows[index]?.[3] ?? '';
        const expected = oracle.dates[index] ?? '';
        if (expected === '') {
          expect([name, index, date]).toEqual([name, index, '(no date)']);
        } else {
          expect([name, index, date]).toEqual([name, index, expected]);
        }
      }
    }
  });

  it('counts the same attachments Python counts per message', async () => {
    for (const [name, oracle] of Object.entries(ORACLE)) {
      const result = await run(name, 'messages');
      const counts = table(result).rows.map((row) =>
        row[6] === '-' ? 0 : Number.parseInt(row[6] ?? '0', 10),
      );
      expect([name, counts]).toEqual([name, oracle.attachmentCounts]);
    }
  });
});

describe('summary view', () => {
  it('reads the envelope sender and install-time facts from the From_ line', async () => {
    const result = await run('sample.mbox', 'summary');
    const summary = map(result);
    expect(summary.get('Source')).toBe('sample.mbox');
    expect(summary.get('Messages')).toBe('4');
    expect(summary.get('Unique senders')).toBe('3');
    expect(summary.get('Unique Message-IDs')).toBe('4');
    expect(summary.get('Messages with attachments')).toBe('1');
    expect(summary.get('Attachments')).toContain('1');
    expect(summary.get('Line endings')).toBe('LF');
    expect(summary.get('Date range')).toBe('2025-01-06 to 2025-06-03');
    expect(summary.get('Flagged as read')).toBe('2 read, 1 answered');
    expect(summary.get('Findings')).toMatch(/^0 error, /u);
    expect(result.stats?.errors).toBe(0);
    expect(result.stats?.attachments).toBe(1);
  });

  it('counts mboxrd escaping and unescapes the body the way a reader does', async () => {
    expect(
      rows(await run('escaped.mbox', 'findings')).some((row) =>
        (row[1] ?? '').includes('mboxrd escaping'),
      ),
    ).toBe(true);
    const summary = map(await run('escaped.mbox', 'summary'));
    expect(summary.get('Escaped From_ lines')).toBe('2');
    // Python's mailbox keeps ">From ..." in the payload; this tool strips exactly one '>' per
    // escaped line, so line 2 keeps its second '>' — 44 B, where the escaped form is 45 B.
    expect(summary.get('Body text')).toBe('44 B in 2 lines');
  });

  it('renders a usable fallback when a message carries no date', async () => {
    const result = await run('nodate.mbox', 'messages');
    expect(rows(result).some((row) => row[3] === '(no date)')).toBe(true);
    const summary = map(await run('nodate.mbox', 'summary'));
    expect(summary.get('Date range')).toBe('no message carries a parseable date');
  });
});

describe('messages view', () => {
  it('lists each message with its subject and readable size', async () => {
    const result = await run('sample.mbox', 'messages');
    const rows = table(result).rows;
    const first = rows[0] ?? [];
    expect(first[0]).toBe('1');
    expect(first[1]).toBe('Alice <alice@example.com>');
    expect(first[2]).toBe('bob@example.com');
    expect(first[3]).toBe('2025-01-06 09:12');
    expect(first[4]).toBe('Quarterly numbers');
    expect(first[5]).toBe(ORACLE['sample.mbox']?.sizes[0]);
    expect(first[6]).toBe('-');
    expect(rows[3]?.[6]).toBe('1');
    expect(first[7]).toBe('read, old');
    expect(rows[2]?.[1]).toContain('Carol');
    expect(rows[2]?.[6]).toBe('-');
  });
});

describe('senders view', () => {
  it('ranks senders by message count and shares the message base', async () => {
    const result = await run('sample.mbox', 'senders');
    const rows = table(result).rows;
    expect(rows[0]?.[1]).toContain('alice@example.com');
    expect(rows[0]?.[2]).toBe('2');
    expect(rows[0]?.[4]).toBe('50.0%');
    expect(rows[1]?.[1]).toContain('bob@example.com');
    expect(rows[2]?.[1]).toContain('carol@example.com');
    expect(rows[0]?.[5]).toBe('2025-06-03 08:00');
  });

  it('groups messages with no address under a named fallback', async () => {
    const result = await run('flagsonly.mbox', 'senders');
    expect(table(result).rows.some((row) => (row[1] ?? '').includes('(no sender)'))).toBe(true);
  });
});

describe('attachments view', () => {
  it('reports the largest attachment with its decoded size', async () => {
    const result = await run('sample.mbox', 'attachments');
    const rows = table(result).rows;
    expect(rows.length).toBe(1);
    expect(rows[0]?.[2]).toBe('report.pdf');
    expect(rows[0]?.[3]).toBe('application/pdf');
    expect(rows[0]?.[4]).toBe('base64');
    expect(rows[0]?.[5]).toBe(ORACLE['sample.mbox']?.attachmentSizes[0]);
  });

  it('says so when there are none', async () => {
    const result = await run('escape-only.mbox', 'attachments');
    expect(table(result).rows).toEqual([['-', '-', '(no attachments)', '-', '-', '-']]);
  });
});

describe('findings view', () => {
  it('warns about a message with no Date and one with no From', async () => {
    const rows = table(await run('nodate.mbox', 'findings')).rows;
    expect(rows.some((row) => (row[1] ?? '').includes('no Date header'))).toBe(true);
    const flagged = table(await run('flagsonly.mbox', 'findings')).rows;
    expect(flagged.some((row) => (row[1] ?? '').includes('no From header'))).toBe(true);
  });

  it('catches two messages with the same Message-ID', async () => {
    const result = await run('duplicate.mbox', 'findings');
    const problem = table(result).rows.find((row) =>
      (row[1] ?? '').startsWith('Duplicate Message-ID'),
    );
    expect(problem?.[0]).toBe('warning');
    expect(problem?.[2]).toContain('1, 3');
  });

  it('reports a reply whose parent is outside the archive', async () => {
    const result = await run('dangling.mbox', 'findings');
    const problem = table(result).rows.find((row) =>
      (row[1] ?? '').includes('parent outside this archive'),
    );
    expect(problem?.[0]).toBe('note');
    expect(problem?.[2]).toContain('<parent@nowhere>');
  });

  it('flags a base64 payload with a broken character', async () => {
    const result = await run('badbase64.mbox', 'findings');
    expect(
      table(result).rows.some((row) => (row[1] ?? '').includes('characters outside base64')),
    ).toBe(true);
  });

  it('notes a multipart boundary that never appears', async () => {
    const result = await run('brokenmime.mbox', 'findings');
    expect(
      table(result).rows.some((row) => (row[1] ?? '').includes('boundary that never appears')),
    ).toBe(true);
  });

  it('notes a header line that is not a header (a missing blank line)', async () => {
    const result = await run('noblank.mbox', 'findings');
    expect(table(result).rows.some((row) => (row[1] ?? '').includes('not a header'))).toBe(true);
  });

  it('flags a message block with no headers at all', async () => {
    const result = await run('noheaders.mbox', 'findings');
    expect(table(result).rows.some((row) => (row[1] ?? '').includes('no headers at all'))).toBe(
      true,
    );
  });

  it('reports an unescaped From_ inside a body, the classic silent split', async () => {
    const summary = map(await run('fragile.mbox', 'summary'));
    expect(summary.get('Messages')).toBe('2');
    const rows = table(await run('fragile.mbox', 'findings')).rows;
    expect(rows.some((row) => (row[1] ?? '').includes('no headers at all'))).toBe(true);
    expect(rows.some((row) => (row[1] ?? '').includes('without a blank line before them'))).toBe(
      true,
    );
  });

  it('notes CRLF endings, which change where a reader ends a message', async () => {
    const summary = map(await run('crlf.mbox', 'summary'));
    expect(summary.get('Line endings')).toBe('CRLF');
    expect(summary.get('Messages')).toBe(String(ORACLE['crlf.mbox']?.count));
    expect(
      table(await run('crlf.mbox', 'findings')).rows.some((row) =>
        (row[1] ?? '').includes('CRLF line endings'),
      ),
    ).toBe(true);
  });

  it('reports a clean archive as clean', async () => {
    const result = await run('clean.mbox', 'findings');
    expect(table(result).rows).toEqual([
      [
        'ok',
        'Nothing to flag',
        'Every message has the headers a reader needs and no archive-level problem was found.',
      ],
    ]);
  });
});

describe('pasting text', () => {
  it('reads the archive from a pasted body when no file is given', async () => {
    const result = (await tool.run({
      files: [],
      text: FIXTURES['clean.mbox'] ?? '',
      options: { format: 'summary' },
    })) as unknown as Result;
    expect(result.stats?.messages).toBe(1);
    const summary = map(result);
    expect(summary.get('Source')).toBe('pasted text');
  });

  it('rejects text with no From_ separator', async () => {
    await expect(
      tool.run({ files: [], text: 'just some prose, no separator', options: {} }),
    ).rejects.toThrow(/No mbox separator/u);
  });

  it('rejects an empty file', async () => {
    await expect(tool.run({ files: [new File([''], 'empty.mbox')], options: {} })).rejects.toThrow(
      /empty/u,
    );
  });
});
