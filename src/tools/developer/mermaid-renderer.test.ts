import { describe, it, expect } from 'vitest';
import { renderMermaid, resolveOptions } from './mermaid-renderer.core';
import type { MermaidRenderOptions } from './mermaid-renderer.core';

describe('mermaid-renderer', () => {
  describe('resolveOptions', () => {
    it('accepts valid theme', () => {
      expect(resolveOptions({ theme: 'dark' })).toEqual({
        theme: 'dark',
        scale: 1,
        showControls: true,
      });
    });

    it('falls back to defaults', () => {
      expect(resolveOptions({})).toEqual({ theme: 'default', scale: 1, showControls: true });
    });

    it('validates scale bounds', () => {
      expect(() => resolveOptions({ scale: 0.05 })).toThrow('Scale must be between 0.1 and 5');
      expect(() => resolveOptions({ scale: 6 })).toThrow('Scale must be between 0.1 and 5');
    });
  });

  describe('renderMermaid', () => {
    it.skip('renders valid Mermaid source to SVG', async () => {
      const result = await renderMermaid('graph TD\n    A[Hello] --> B[World]', {
        theme: 'default',
        scale: 1,
        showControls: false,
      });
      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('Hello World');
    });

    it.skip('returns PNG when scale > 0', async () => {
      const result = await renderMermaid('graph TD\n    A --> B', {
        theme: 'default',
        scale: 1,
        showControls: false,
      });
      expect(result.png).toBeDefined();
      expect(result.png).toMatch(/^data:image\/png;base64,/);
    });

    it('throws on empty source', async () => {
      await expect(
        renderMermaid('', { theme: 'default', scale: 1, showControls: false }),
      ).rejects.toThrow('Mermaid source cannot be empty');
    });
  });
});
