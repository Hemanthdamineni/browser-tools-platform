import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * The core promise: a tool that declares `network: 'none'` must not cause any
 * cross-origin request when it runs. This test loads every such tool page,
 * exercises it, and fails if anything leaves the origin.
 */

interface ToolEntry {
  id: string;
  href: string;
  input: 'text' | 'file';
  privacy: { network: 'none' | string[] };
  hasExamples: boolean;
}

// Requests the app legitimately makes to its own origin / the browser itself.
const ALLOWED_ORIGINS = new Set(['http://localhost:4321']);

let tools: ToolEntry[] = [];

test.beforeAll(async ({ baseURL }) => {
  const ctx = await pwRequest.newContext();
  const res = await ctx.get(`${baseURL}/tools-index.json`);
  expect(res.ok()).toBeTruthy();
  tools = (await res.json()) as ToolEntry[];
  expect(tools.length).toBeGreaterThan(0);
  await ctx.dispose();
});

test('every declared no-network tool makes zero cross-origin requests', async ({
  page,
  baseURL,
}) => {
  // Budget scales with the catalogue: visit + exercise + settle per tool.
  const local = () => tools.filter((t) => t.privacy.network === 'none');
  test.setTimeout(Math.max(120_000, local().length * 4_000));
  const localOnly = () => tools.filter((t) => t.privacy.network === 'none');
  const offenders: { tool: string; url: string }[] = [];

  for (const tool of localOnly()) {
    const seen: string[] = [];
    const handler = (req: import('@playwright/test').Request) => {
      const origin = new URL(req.url()).origin;
      if (
        !ALLOWED_ORIGINS.has(origin) &&
        !req.url().startsWith('data:') &&
        !req.url().startsWith('blob:')
      ) {
        seen.push(req.url());
      }
    };
    page.on('request', handler);

    await page.goto(`${baseURL}${tool.href}`, { waitUntil: 'networkidle' });

    // Exercise it.
    if (tool.input === 'text') {
      const example = page.locator('[data-example]').first();
      if (await example.count()) {
        await example.click();
      } else {
        const input = page.locator('[data-input]');
        if (await input.count()) await input.fill('toolbench privacy probe 123 ✅');
      }
      const run = page.locator('[data-run]');
      if (await run.count()) await run.click();
    }
    // File tools need a real file drop we can't safely automate for all types;
    // loading the page + worker script is still covered above.

    await page.waitForTimeout(400);
    page.off('request', handler);

    for (const url of seen) offenders.push({ tool: tool.id, url });
  }

  expect(
    offenders,
    `Unexpected cross-origin requests:\n${offenders.map((o) => `  ${o.tool} -> ${o.url}`).join('\n')}`,
  ).toEqual([]);
});

test('the site loads no third-party scripts, fonts or stylesheets anywhere', async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const origin = new URL(req.url()).origin;
    if (
      !ALLOWED_ORIGINS.has(origin) &&
      ['script', 'stylesheet', 'font', 'image', 'xhr', 'fetch'].includes(req.resourceType())
    ) {
      external.push(`${req.resourceType()} ${req.url()}`);
    }
  });
  for (const path of ['/', '/tools', '/categories', '/privacy', '/about']) {
    await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
  }
  expect(external, external.join('\n')).toEqual([]);
});
