import { test, expect, request as pwRequest } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

interface ToolEntry {
  id: string;
  name: string;
  href: string;
  input: 'text' | 'file';
  hasExamples: boolean;
}

let tools: ToolEntry[] = [];

test.beforeAll(async ({ baseURL }) => {
  const ctx = await pwRequest.newContext();
  const res = await ctx.get(`${baseURL}/tools-index.json`);
  tools = (await res.json()) as ToolEntry[];
  await ctx.dispose();
});

test('core pages render and are accessible', async ({ page, baseURL }) => {
  for (const path of ['/', '/tools', '/categories', '/privacy', '/about', '/404']) {
    const res = await page.goto(`${baseURL}${path}`);
    // 404 is served as a page; every other path is 200.
    expect(res, path).toBeTruthy();
    await expect(page.locator('h1')).toBeVisible();
    await page.addScriptTag({ path: AXE_PATH });
    const results = await page.evaluate(async () => {
      // @ts-expect-error injected
      return await window.axe.run(document, {
        runOnly: ['wcag2a', 'wcag2aa'],
        resultTypes: ['violations'],
      });
    });
    const serious = results.violations.filter(
      (v: { impact: string }) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious,
      `${path}: ${serious.map((v: { id: string; description: string }) => `${v.id} — ${v.description}`).join('; ')}`,
    ).toEqual([]);
  }
});

test('every tool page renders a working workbench', async ({ page, baseURL }) => {
  const failures: string[] = [];
  for (const tool of tools) {
    await page.goto(`${baseURL}${tool.href}`);
    if (!(await page.locator('h1', { hasText: tool.name }).count())) {
      failures.push(`${tool.id}: no <h1> "${tool.name}"`);
      continue;
    }
    const workbench = page.locator('[data-text-workbench], [data-file-workbench]');
    if (!(await workbench.count())) {
      failures.push(`${tool.id}: no workbench`);
      continue;
    }
    if (tool.input === 'text' && tool.hasExamples) {
      await page.locator('[data-example]').first().click();
      await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 5000 });
      const err = page.locator('[data-error]');
      if (await err.isVisible()) failures.push(`${tool.id}: example produced an error`);
    }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

test('search dialog opens and finds a tool', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`);
  await page.keyboard.press('/');
  const input = page.locator('#search-input');
  await expect(input).toBeFocused();
  await input.fill('base64');
  await expect(page.locator('#search-results a').first()).toContainText(/base64/i);
});
