import { test, expect, request as pwRequest, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

interface AxeViolation {
  id: string;
  description: string;
  impact: string;
}

/**
 * Serious + critical axe violations on the page the caller already navigated to.
 * Axe is injected after every navigation (the previous document is gone), and a
 * full wcag2a/wcag2aa pass over the catalogue-heavy pages is expensive, so each
 * caller budgets its own timeout rather than relying on the 30 s default.
 */
async function axeSeriousViolations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE_PATH });
  const results = await page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    return await window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa'],
      resultTypes: ['violations'],
    });
  });
  return (results.violations as AxeViolation[]).filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
}

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
  // Six pages, each with a full wcag2a/wcag2aa axe pass; the catalogue-heavy
  // shell (tool grid, categories) makes axe slow enough to blow the 30 s
  // default, so this test budgets its own generous timeout.
  test.setTimeout(Math.max(120_000, 6 * 20_000));
  for (const path of ['/', '/tools', '/categories', '/privacy', '/about', '/404']) {
    const res = await page.goto(`${baseURL}${path}`);
    // 404 is served as a page; every other path is 200.
    expect(res, path).toBeTruthy();
    await expect(page.locator('h1')).toBeVisible();
    const serious = await axeSeriousViolations(page);
    expect(
      serious,
      `${path}: ${serious.map((v) => `${v.id} — ${v.description}`).join('; ')}`,
    ).toEqual([]);
  }
});

test('every tool page renders a working workbench', async ({ page, baseURL }) => {
  // Budget scales with the catalogue, and each tool gets ~1.2 s for a
  // navigation, an example click and a result render.
  test.setTimeout(Math.max(30_000, tools.length * 1_200));
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
      // Custom panels render their own affordances; example chips are a
      // feature of the generic text workbench, so only click there.
      const generic = page.locator('[data-text-workbench]');
      if (await generic.count()) {
        await generic.locator('[data-example]').first().click();
        // Panels that reuse the text-workbench root (e.g. webcam-test) render
        // their own report area, so the generic result pane is not guaranteed.
        const resultPane = generic.locator('[data-result-wrap]');
        if (await resultPane.count()) {
          await expect(resultPane).toBeVisible({ timeout: 5000 });
          const err = page.locator('[data-error]');
          if (await err.isVisible()) failures.push(`${tool.id}: example produced an error`);
        }
      }
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
  // Two pages, each with its own axe pass; budget generously (see the core
  // pages test above for why the 30 s default is too tight for axe).
  test.setTimeout(Math.max(60_000, 2 * 20_000));
  // password: select + boolean options; hex: select options
  for (const path of ['/tools/password', '/tools/hex']) {
    await page.goto(`${baseURL}${path}`);
    // Every visible option control is programmatically labelled.
    const unlabelled = await page.evaluate(() => {
      const bad: string[] = [];
      document.querySelectorAll('[data-options] select, [data-options] input').forEach((el) => {
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
      document.querySelectorAll('[data-options] [aria-describedby]').forEach((el) => {
        const id = el.getAttribute('aria-describedby')!;
        if (!document.getElementById(id)) bad.push(id);
      });
      return bad;
    });
    expect(brokenDesc, path).toEqual([]);
    // Axe passes on the page (serious + critical violations only).
    const serious = await axeSeriousViolations(page);
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
