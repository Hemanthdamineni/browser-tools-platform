import { describe, expect, it } from 'vitest';
import tool from './dockerfile-generator.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('dockerfile-generator', () => {
  it('emits the conventional layout from defaults', async () => {
    const r = await run('', {});
    const o = r.output;
    expect(o).toContain('FROM node:20-alpine');
    expect(o).toContain('WORKDIR /app');
    expect(o).toContain('ENV NODE_ENV=production');
    expect(o).toContain('COPY package*.json ./');
    expect(o).toContain('RUN npm ci --omit=dev');
    expect(o).toContain('EXPOSE 3000');
    expect(o).toContain('CMD ["npm", "start"]');
  });

  it('uses JSON-array CMD so values with spaces survive', async () => {
    const r = await run('', { cmd: 'uvicorn main:app --host 0.0.0.0' });
    expect(r.output).toContain('CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]');
  });

  it('adds ENTRYPOINT before EXPOSE and emits multiple ports', async () => {
    const r = await run('', { ports: '3000, 8080', entrypoint: 'sh start.sh' });
    const o = r.output;
    expect(o.indexOf('ENTRYPOINT ["sh", "start.sh"]')).toBeGreaterThan(-1);
    expect(o.indexOf('EXPOSE 8080')).toBeGreaterThan(o.indexOf('EXPOSE 3000'));
    expect(o).toContain('EXPOSE 3000');
    expect(o).toContain('EXPOSE 8080');
  });

  it('rejects invalid ports, relative workdir, bad COPY and empty CMD/base', async () => {
    await expect(run('', { ports: 'abc' })).rejects.toThrow(/ports must be numbers/i);
    await expect(run('', { workdir: 'app' })).rejects.toThrow(/absolute path/i);
    await expect(run('', { copy: 'src' })).rejects.toThrow(/source and a destination/i);
    await expect(run('', { cmd: '' })).rejects.toThrow(/default command/i);
    await expect(run('', { base: '  ' })).rejects.toThrow(/base image/i);
  });
});
