import { describe, it, expect, vi } from 'vitest';
import tool, { buildReport, parseSession } from './speaker-test.tool';
import { ToolError } from '@/lib/types';

// The tool's report imports the panel module for the shared maths; that module
// talks to the worker client, which in turn builds the whole registry. Mock it
// so these tests run on the pure logic in isolation.
vi.mock('@/lib/worker/client', () => ({
  runToolById: vi.fn(),
}));

/** A session payload as the panel would hand it over. */
function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    plays: [
      {
        channel: 'both',
        mode: 'tone',
        frequency: 440,
        sweepEnd: 440,
        durationMs: 3000,
        at: '2026-10-24T10:15:30.000Z',
      },
      {
        channel: 'right',
        mode: 'sweep',
        frequency: 20,
        sweepEnd: 20000,
        durationMs: 6000,
        at: '2026-10-24T10:16:00.000Z',
      },
    ],
    ...overrides,
  });
}

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as {
    output: string;
    render?: string;
    stats?: Record<string, string | number>;
    notes?: string[];
    warnings?: string[];
  };

describe('speaker-test parseSession', () => {
  it('parses a well-formed session', () => {
    const { plays } = parseSession(payload());
    expect(plays).toHaveLength(2);
    expect(plays[0]!.channel).toBe('both');
    expect(plays[1]!.mode).toBe('sweep');
    expect(plays[1]!.sweepEnd).toBe(20000);
  });

  it('throws when the payload is empty', () => {
    expect(() => parseSession('')).toThrow(ToolError);
    expect(() => parseSession('  ')).toThrow(/No plays/);
  });

  it('throws for invalid JSON', () => {
    expect(() => parseSession('not json')).toThrow(/could not be read/);
  });

  it('throws when plays is missing or malformed', () => {
    expect(() => parseSession('{}')).toThrow(/no plays/);
    expect(() => parseSession(JSON.stringify({ plays: 'x' }))).toThrow(/no plays/);
    expect(() =>
      parseSession(JSON.stringify({ plays: [{ channel: 'up', mode: 'tone' }] })),
    ).toThrow(/unknown channel/);
    expect(() =>
      parseSession(JSON.stringify({ plays: [{ channel: 'left', mode: 'pulse' }] })),
    ).toThrow(/unknown mode/);
  });
});

describe('speaker-test buildReport', () => {
  it('produces a table with a row per play and exact known values', () => {
    const { output } = buildReport(parseSession(payload()), {});
    const table = JSON.parse(output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual([
      'Test',
      'Channel',
      'Frequency',
      'Note',
      'Duration',
      'When (UTC)',
    ]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toEqual(['Tone 440 Hz', 'Both', '440 Hz', 'A4', '3 s', '10:15:30']);
  });

  it('drops the timestamp column when the option is off', () => {
    const { output } = buildReport(parseSession(payload()), { includeTimestamps: false });
    const table = JSON.parse(output) as { headers: string[]; rows: string[][] };
    expect(table.headers).not.toContain('When (UTC)');
    expect(table.rows[0]).toHaveLength(5);
  });

  it('always warns about the volume', () => {
    const { warnings } = buildReport(parseSession(payload()), {});
    expect(warnings.join(' ')).toMatch(/volume/i);
  });

  it('notes the last play in an empty vs filled session', () => {
    const empty = buildReport(parseSession(JSON.stringify({ plays: [] })), {});
    expect(empty.notes.join(' ')).toMatch(/No plays/);
    expect(empty.stats.plays).toBe(0);
  });
});

describe('speaker-test run', () => {
  it('renders a table report for a real session', () => {
    const r = run(payload());
    expect(r.render).toBe('table');
    expect(JSON.parse(r.output)).toHaveProperty('rows');
    expect(r.stats?.plays).toBe(2);
  });

  it('rejects an empty session through run', () => {
    expect(() => run('')).toThrow(ToolError);
  });
});
