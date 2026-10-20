import { describe, expect, it } from 'vitest';
import tool from './crontab-generator.tool';

type Result = { output: string; render?: string; notes?: string[]; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const out = (o: Record<string, string | number | boolean>) =>
  run('', o).then((r) => r.output.trim());

describe('crontab-generator', () => {
  it('builds every-minute and step presets', async () => {
    expect(await out({ preset: 'every-minute' })).toBe('* * * * *');
    expect(await out({ preset: 'every-5-minutes' })).toBe('*/5 * * * *');
    expect(await out({ preset: 'every-15-minutes' })).toBe('*/15 * * * *');
  });

  it('builds hourly, daily, weekly and monthly from fields', async () => {
    expect(await out({ preset: 'hourly', minute: 30 })).toBe('30 * * * *');
    expect(await out({ preset: 'daily', hour: 9, minute: 5 })).toBe('5 9 * * *');
    expect(await out({ preset: 'weekly', hour: 7, minute: 0, dayOfWeek: '0' })).toBe('0 7 * * 0');
    expect(await out({ preset: 'monthly', hour: 0, minute: 0, dayOfMonth: 15 })).toBe('0 0 15 * *');
  });

  it('uses raw fields for the custom preset', async () => {
    expect(
      await out({
        preset: 'custom',
        minuteField: '*/10',
        hourField: '9-17',
        dayOfWeekField: 'MON-FRI',
      }),
    ).toBe('*/10 9-17 * * MON-FRI');
  });

  it('appends a command when provided', async () => {
    const r = await run('', { preset: 'daily', hour: 3, minute: 30, command: '/usr/bin/backup' });
    expect(r.output.trim()).toBe('30 3 * * * /usr/bin/backup');
  });

  it('rejects invalid fields', async () => {
    await expect(run('', { preset: 'custom', minuteField: '*/0' })).rejects.toThrow(/step/);
    await expect(run('', { preset: 'custom', hourField: '25' })).rejects.toThrow(/outside 0–23/);
    await expect(run('', { preset: 'custom', dayOfWeekField: 'NOPE' })).rejects.toThrow(
      /unknown name/,
    );
  });
});
