import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_TOOLS } from '@/lib/registry';

/** Absolute path of the panel directory, so the test can look for panel files. */
const panelDir = join(process.cwd(), 'src', 'components', 'panels');

describe('tool panels', () => {
  it('resolves every custom panel id to a component file', () => {
    for (const tool of ALL_TOOLS) {
      const panel = tool.meta.panel;
      // 'signature' is the built-in panel and lives with the other workbenches.
      if (!panel || panel === 'signature') continue;
      const file = join(panelDir, `${panel}.astro`);
      expect(
        existsSync(file),
        `tool "${tool.meta.id}" asks for panel "${panel}" but ${file} does not exist`,
      ).toBe(true);
    }
  });

  it('keeps the built-in signature panel in the workbench folder', () => {
    const builtIn = join(
      process.cwd(),
      'src',
      'components',
      'workbench',
      'SignatureWorkbench.astro',
    );
    expect(existsSync(builtIn)).toBe(true);
  });
});
