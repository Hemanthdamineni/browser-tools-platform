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
  // Budget scales with the catalogue so a large catalog never trips the default.
  test.setTimeout(Math.max(30_000, tools.length * 400));
  const failures: string[] = [];
  for (const tool of tools) {
    await page.goto(`${baseURL}${tool.href}`);
    if (!(await page.locator('h1', { hasText: tool.name }).count())) {
      failures.push(`${tool.id}: no <h1> "${tool.name}"`);
      continue;
    }
    const workbench = page.locator(
      '[data-text-workbench], [data-file-workbench], [data-panel-workbench]',
    );
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

test('option fields are accessible (axe on tools with select/boolean/range/number options)', async ({
  page,
  baseURL,
}) => {
  // password: select + boolean options; hex: select options
  for (const path of ['/tools/password', '/tools/hex']) {
    await page.goto(`${baseURL}${path}`);
    // Every visible option control is programmatically labelled.
    const unlabelled = await page.evaluate(() => {
      const bad: string[] = [];
      document
        .querySelectorAll('[data-options] select, [data-options] input')
        .forEach((el) => {
          const labelled =
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            (el.id && document.querySelector(`label[for="${el.id}"]`)) ||
            el.closest('label');
          if (!labelled) bad.push(el.getAttribute('data-opt-key') ?? el.outerHTML.slice(0, 60));
        });
      return bad;
    });
    expect(unlabelled, path).toEqual([]);
    // Help text is wired via aria-describedby where present.
    const brokenDesc = await page.evaluate(() => {
      const bad: string[] = [];
      document
        .querySelectorAll('[data-options] [aria-describedby]')
        .forEach((el) => {
          const id = el.getAttribute('aria-describedby')!;
          if (!document.getElementById(id)) bad.push(id);
        });
      return bad;
    });
    expect(brokenDesc, path).toEqual([]);
    // Axe passes on the page.
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
    expect(serious, path).toEqual([]);
  }
});

test('search dialog traps focus, supports Esc and restores focus to the trigger', async ({
  page,
  baseURL,
}) => {
  await page.goto(`${baseURL}/`);
  const trigger = page.getByRole('button', { name: /search/i }).first();
  await trigger.focus();
  await page.keyboard.press('/');
  await expect(page.locator('#search-dialog')).toBeVisible();
  await expect(page.locator('#search-input')).toBeFocused();

  // Focus is trapped inside the native <dialog>: Tab cycles within it.
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);

  // Esc closes the dialog…
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-dialog')).not.toBeVisible();
  // …and focus returns to the trigger.
  await expect(trigger).toBeFocused();
});
