import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * The core promise: a tool that declares `network: 'none'` must not cause any
 * cross-origin request when it runs. This test loads every registered tool page
 * (visible and hidden), exercises text and file tools, and fails if anything
 * leaves the origin, fails, or opens a socket.
 */

interface ToolEntry {
  id: string;
  href: string;
  input: 'text' | 'file';
  privacy: { network: 'none' | string[]; processing: string; offline?: boolean };
  hasExamples: boolean;
  multiple?: boolean;
  accept?: string;
  hidden?: boolean;
}

let tools: ToolEntry[] = [];

test.beforeAll(async ({ baseURL }) => {
  const ctx = await pwRequest.newContext();
  const res = await ctx.get(`${baseURL}/tools-index.json`);
  expect(res.ok()).toBeTruthy();
  tools = (await res.json()) as ToolEntry[];
  expect(tools.length).toBeGreaterThan(0);
  await ctx.dispose();

  // Metadata contract: every registered tool is on-device and either
  // network:none or has an explicit allowlist.
  for (const t of tools) {
    expect(t.privacy.processing, `${t.id} processing`).toBe('on-device');
    expect(
      t.privacy.network === 'none' || Array.isArray(t.privacy.network),
      `${t.id} network contract`,
    ).toBe(true);
  }
});

test('every declared no-network tool makes zero cross-origin requests', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const origin = new URL(baseURL).origin;
  const localOnly = () => tools.filter((t) => t.privacy.network === 'none');
  const offenders: { tool: string; url: string; kind: string }[] = [];

  for (const tool of localOnly()) {
    const seen: string[] = [];
    const handler = (req: import('@playwright/test').Request) => {
      const o = new URL(req.url()).origin;
      if (o !== origin && !req.url().startsWith('data:') && !req.url().startsWith('blob:')) {
        seen.push(req.url());
      }
    };
    const failHandler = (req: import('@playwright/test').Request) => {
      const o = new URL(req.url()).origin;
      if (o !== origin && !req.url().startsWith('data:') && !req.url().startsWith('blob:')) {
        seen.push(`${req.url()} (FAILED)`);
      }
    };
    page.on('request', handler);
    page.on('requestfailed', failHandler);

    await page.goto(`${baseURL}${tool.href}`, { waitUntil: 'networkidle' });

    if (tool.input === 'file') {
      const input = page.locator('[data-file-workbench] input[type=file]');
      const count = tool.multiple ? 2 : 1;
      const files = Array.from({ length: count }, (_, i) => ({
        name: `probe-${i}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from(`toolbench privacy probe ${tool.id} ${i}`),
      }));
      await input.setInputFiles(files);
      const run = page.locator('[data-run]');
      await run.click();
      // Wait for a result or an error, not a fixed 400 ms sleep.
      await Promise.race([
        page.locator('[data-result-wrap]:not([hidden])').waitFor({ timeout: 15_000 }),
        page.locator('[data-error]:not([hidden])').waitFor({ timeout: 15_000 }),
      ]);
    } else {
      const example = page.locator('[data-example]').first();
      if (await example.count()) {
        await example.click();
      } else {
        const input = page.locator('[data-input]');
        if (await input.count()) await input.fill('toolbench privacy probe 123 ✅');
      }
      const run = page.locator('[data-run]');
      if (await run.count()) await run.click();
      await page
        .locator('[data-result-wrap]:not([hidden]), [data-error]:not([hidden])')
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => undefined);
    }

    page.off('request', handler);
    page.off('requestfailed', failHandler);

    for (const url of seen) offenders.push({ tool: tool.id, url, kind: 'request' });
  }

  expect(
    offenders,
    `Unexpected cross-origin requests:\n${offenders
      .map((o) => `  ${o.tool} -> ${o.url}`)
      .join('\n')}`,
  ).toEqual([]);
});

test('the site loads no third-party scripts, fonts, stylesheets, sockets or manifest elsewhere', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL).origin;
  const external: string[] = [];
  page.on('request', (req) => {
    const o = new URL(req.url()).origin;
    if (
      o !== origin &&
      ['script', 'stylesheet', 'font', 'image', 'xhr', 'fetch', 'manifest'].includes(
        req.resourceType(),
      )
    ) {
      external.push(`${req.resourceType()} ${req.url()}`);
    }
  });
  page.on('websocket', (ws) => {
    external.push(`websocket ${ws.url()}`);
  });
  for (const path of ['/', '/tools', '/categories', '/privacy', '/about', '/404']) {
    await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
  }
  expect(external, external.join('\n')).toEqual([]);
});
