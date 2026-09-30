import { describe, it, expect } from 'vitest';
import tool from './random-data.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output;

describe('random-data', () => {
  it('person rows=5 as JSON parses to 5 objects with firstName', () => {
    const parsed: { firstName: unknown }[] = JSON.parse(
      run('', { dataset: 'person', rows: 5, format: 'json' }),
    );
    expect(parsed).toHaveLength(5);
    parsed.forEach((p) => expect(typeof p.firstName).toBe('string'));
  });

  it('csv format has header + N lines', () => {
    const lines = run('', { dataset: 'person', rows: 5, format: 'csv' }).split('\n');
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain('firstName');
  });

  it('sql format emits INSERT INTO <table> lines', () => {
    const lines = run('', { dataset: 'person', rows: 5, format: 'sql', tableName: 'users' }).split(
      '\n',
    );
    expect(lines).toHaveLength(5);
    lines.forEach((l) => expect(l).toMatch(/^INSERT INTO users \(/));
  });

  it('network dataset yields plausible fields', () => {
    const [row] = JSON.parse(run('', { dataset: 'network', rows: 1 }));
    expect(row.ipv4).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(row.ipv6).toMatch(/^([0-9a-f]{4}:){7}[0-9a-f]{4}$/);
    expect(row.mac).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
  });

  it('ids dataset yields uuid/objectId/nanoid/ulid', () => {
    const [row] = JSON.parse(run('', { dataset: 'ids', rows: 1 }));
    expect(row.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.objectId).toMatch(/^[0-9a-f]{24}$/);
    expect(row.nanoid).toHaveLength(21);
    expect(row.ulid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('rows=500 max is respected', () => {
    const parsed: unknown[] = JSON.parse(run('', { dataset: 'lorem', rows: 9999 }));
    expect(parsed).toHaveLength(500);
  });
});
