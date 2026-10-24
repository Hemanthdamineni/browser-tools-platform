import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The stats strip lives in the inline `<script>` of `FileWorkbench.astro` —
 * there is no importable sidecar (unlike `data-uri.ts` or
 * `signature-workbench.ts`) — so the *behaviour* is exercised end to end in
 * `e2e/workbench-robustness.spec.ts`. This co-located test pins the two
 * structural guarantees the e2e run depends on: the stats host sits above the
 * outputs, and every stats key/value is escaped before it becomes HTML.
 */
const source = readFileSync(
  join(process.cwd(), 'src', 'components', 'workbench', 'FileWorkbench.astro'),
  'utf8',
);

describe('FileWorkbench · result stats', () => {
  it('renders a stats host above the downloadable outputs', () => {
    expect(source).toContain('data-stats');
    // The first `data-stats` occurrence is the host markup, which must precede
    // the outputs list inside the results region.
    expect(source.indexOf('data-stats')).toBeLessThan(source.indexOf('data-outputs'));
  });

  it('escapes both stats keys and values before writing them as HTML', () => {
    // The only innerHTML write that renders stats escapes the key and the
    // value, so a hostile tool result can never inject elements.
    expect(source).toContain('escapeHtml(key)');
    expect(source).toContain('escapeHtml(String(value))');
  });

  it('clears the stats host when the workbench is reset', () => {
    expect(source).toContain("statsEl.innerHTML = '';");
  });
});