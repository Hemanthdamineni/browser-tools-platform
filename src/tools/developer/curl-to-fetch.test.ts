import { describe, expect, it } from 'vitest';
import tool from './curl-to-fetch.tool';

type Result = {
  output: string;
  language?: string;
  stats?: Record<string, number>;
  notes?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('curl-to-fetch', () => {
  it('converts JSON POST to fetch with headers', async () => {
    const cmd =
      'curl -X POST https://api.example.com/users -H \'Content-Type: application/json\' -H \'Authorization: Bearer token123\' -d \'{"name":"Ada","admin":true}\'';
    const r = await run(cmd);
    expect(r.language).toBe('javascript');
    expect(r.output).toContain("method: 'POST'");
    expect(r.output).toContain(`fetch('https://api.example.com/users'`);
    expect(r.output).toContain("'Content-Type': 'application/json'");
    expect(r.output).toContain("'Authorization': 'Bearer token123'");
    expect(r.output).toContain('body: JSON.stringify({');
  });

  it('adds Basic auth from -u and infers GET', async () => {
    const r = await run(
      "curl -u alice:secret 'https://example.com/data?page=2' -H 'Accept: application/json'",
    );
    expect(r.language).toBe('javascript');
    expect(r.output).toContain("method: 'GET'");
    expect(r.output).toContain(
      "'Authorization': 'Basic " + Buffer.from('alice:secret').toString('base64') + "'",
    );
  });

  it('emits python requests and a HEAD method', async () => {
    const r = await run('curl -I -u bob:pw https://example.com/ping', { target: 'requests' });
    expect(r.language).toBe('python');
    expect(r.output).toContain('import requests');
    expect(r.output).toContain('requests.request(');
    expect(r.output).toContain("'HEAD'");
    expect(r.output).toContain('https://example.com/ping');
  });

  it('emits axios with data', async () => {
    const r = await run(
      "curl -X PUT https://x.example/item -H 'Content-Type: application/json' -d '{\"id\":7}'",
      {
        target: 'axios',
      },
    );
    expect(r.output).toContain('axios.request({');
    expect(r.output).toContain("method: 'PUT'");
    expect(r.output).toContain('data: {');
    expect(r.output).toContain('"id": 7');
  });

  it('converts form data to URLSearchParams and does not force a JSON type', async () => {
    const r = await run('curl -F a=1 -F b=2 https://example.com/submit');
    expect(r.output).toContain("method: 'POST'");
    expect(r.output).toContain('new URLSearchParams({');
    expect(r.output).not.toContain("'Content-Type': 'application/json'");
  });

  it('reports data-urlencode and transport notes rather than dropping silently', async () => {
    const r = await run(
      "curl --data-urlencode 'q=hello world' --compressed https://example.com/search",
    );
    expect(r.output).toContain('q');
    const allHandled = r.notes?.join(' ');
    expect(allHandled ?? '').toContain('--compressed');
  });

  it('handles line continuations and quoting in the tokenizer', async () => {
    const cmd = "curl -X GET \\\n  -H 'X-Token: ab' \\\n  'https://example.com/'";
    const r = await run(cmd);
    expect(r.output).toContain("method: 'GET'");
    expect(r.output).toContain("'X-Token': 'ab'");
  });

  it('rejects empty input and missing URL', async () => {
    await expect(run('   ')).rejects.toThrow(/curl/i);
    await expect(run('curl -X GET')).rejects.toThrow(/URL/i);
  });
});
