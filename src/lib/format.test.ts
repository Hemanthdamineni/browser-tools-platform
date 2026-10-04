import { describe, expect, it } from 'vitest';
import { escapeHtml } from './format';

describe('escapeHtml', () => {
  it('escapes text and quoted-attribute metacharacters', () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)>"'&`)).toBe(
      '&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;',
    );
  });
});
