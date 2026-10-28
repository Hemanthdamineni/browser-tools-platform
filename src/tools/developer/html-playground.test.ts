import { describe, it, expect } from 'vitest';
import { renderPlayground, sanitizeHtml, escapeHtml } from './html-playground.core';

describe('html-playground', () => {
  it('should sanitize dangerous HTML', () => {
    const malicious =
      '<script>alert(1)</script><img src=x onerror=alert(2)> <a href="javascript:alert(3)">click</a>';
    const sanitized = sanitizeHtml(malicious);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('javascript:');
  });

  it('should escape HTML entities', () => {
    const escaped = escapeHtml('<div>Hello & World</div>');
    expect(escaped).toBe('&lt;div&gt;Hello &amp; World&lt;/div&gt;');
    // Escaping the result again must be idempotent-safe for display.
    expect(escapeHtml(escaped)).not.toContain('<div>');
  });

  it('should render valid playground', () => {
    const result = renderPlayground(
      '<h1>Hello</h1>',
      'body { background: red; }',
      'console.log("Hello")',
    );

    expect(result.html).toBe('<h1>Hello</h1>');
    expect(result.previewHtml).toContain('<h1>Hello</h1>');
    expect(result.errors).toBeUndefined();
  });

  it('should handle empty input', () => {
    const result = renderPlayground('', '', '');
    expect(result.errors).toContain('Paste some HTML, CSS or JavaScript');
  });

  it('should sanitize style tags', () => {
    const input = '<style>body { color: red; }</style>';
    const result = renderPlayground(input, '', '');
    expect(result.previewHtml).toContain('/* style removed */');
  });
});