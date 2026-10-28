import { describe, it, expect, vi } from 'vitest';
import {
  escapeXml,
  resolveLanguage,
  computeDimensions,
  highlight,
  buildImageSvg,
  isLightBackground,
  buildFilename,
  svgToDataUrl,
  type ShikiLike,
} from './code-to-image.core';
import { ToolError } from '@/lib/types';

const okShiki: ShikiLike = {
  codeToTokens: () => ({
    bg: '#24292e',
    fg: '#e1e4e8',
    tokens: [
      [
        { content: 'const', color: '#F97583' },
        { content: ' x', color: '#F97583' },
        { content: ' = ', color: '#E1E4E8' },
      ],
      [{ content: 'console.log(x)', color: '#79B8FF' }],
    ],
  }),
};

const failingShiki: ShikiLike = {
  codeToTokens: () => {
    throw new Error('unknown language');
  },
};

describe('escapeXml', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('leaves plain text alone', () => {
    expect(escapeXml('const x = 1')).toBe('const x = 1');
  });
});

describe('resolveLanguage', () => {
  it('uses the explicit choice', () => {
    expect(resolveLanguage('python', 'main.ts', 'const x = 1')).toBe('python');
  });

  it('detects from filename extension', () => {
    expect(resolveLanguage('auto', 'app.py', 'x = 1')).toBe('python');
    expect(resolveLanguage('auto', 'index.tsx', '')).toBe('tsx');
    expect(resolveLanguage('auto', 'schema.sql', '')).toBe('sql');
  });

  it('sniffs JSON content', () => {
    expect(resolveLanguage('auto', undefined, '{"a":1}')).toBe('json');
    expect(resolveLanguage('auto', undefined, '[1,2]')).toBe('json');
  });

  it('sniffs javascript and sql', () => {
    expect(resolveLanguage('auto', undefined, 'const x = () => 1;')).toBe('javascript');
    expect(resolveLanguage('auto', undefined, 'SELECT * FROM users;')).toBe('sql');
  });

  it('falls back to text', () => {
    expect(resolveLanguage('auto', undefined, 'just some words')).toBe('text');
  });
});

describe('computeDimensions', () => {
  it('adds padding, chrome and line height', () => {
    const { width, height } = computeDimensions(10, 40, 32, true);
    expect(width).toBe(Math.max(64 + 336, 420));
    expect(height).toBe(64 + 44 + 10 * 21);
  });

  it('omits chrome height when chrome is off', () => {
    const { height } = computeDimensions(5, 40, 16, false);
    expect(height).toBe(32 + 5 * 21);
  });
});

describe('highlight', () => {
  it('merges adjacent tokens of the same colour', async () => {
    const result = await highlight(okShiki, 'const x', 'typescript', 'github-dark');
    expect(result.bg).toBe('#24292e');
    expect(result.lines[0]!.segments).toEqual([
      { text: 'const x', color: '#F97583' },
      { text: ' = ', color: '#E1E4E8' },
    ]);
  });

  it('keeps differently coloured tokens apart', async () => {
    const result = await highlight(okShiki, 'a\nb', 'typescript', 'github-dark');
    expect(result.lines[1]!.segments).toEqual([{ text: 'console.log(x)', color: '#79B8FF' }]);
  });

  it('throws ToolError when the language fails', async () => {
    await expect(highlight(failingShiki, 'x', 'nope', 'github-dark')).rejects.toThrow(ToolError);
  });
});

describe('buildImageSvg', () => {
  const highlighted = {
    bg: '#24292e',
    fg: '#e1e4e8',
    lines: [{ segments: [{ text: 'const x = 1;', color: '#F97583' }] }],
  };

  it('produces a valid svg wrapper with theme background', () => {
    const { svg, width, height } = buildImageSvg(highlighted, {
      padding: 32,
      background: 'theme',
      customBackground: '#000',
      showChrome: true,
      title: 'main.ts',
    });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('fill="#24292e"');
    expect(svg).toContain('>main.ts</text>');
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('transparent background emits no background rect', () => {
    const { svg } = buildImageSvg(highlighted, {
      padding: 16,
      background: 'transparent',
      customBackground: '#000',
      showChrome: false,
      title: '',
    });
    expect(svg).not.toContain('<rect width');
  });

  it('uses the custom colour', () => {
    const { svg } = buildImageSvg(highlighted, {
      padding: 16,
      background: 'custom',
      customBackground: '#123456',
      showChrome: false,
      title: '',
    });
    expect(svg).toContain('fill="#123456"');
  });

  it('escapes code text inside tspans', () => {
    const hl = {
      bg: '#000000',
      fg: '#ffffff',
      lines: [{ segments: [{ text: '<div>&</div>', color: '#fff' }] }],
    };
    const { svg } = buildImageSvg(hl, {
      padding: 8,
      background: 'theme',
      customBackground: '',
      showChrome: false,
      title: '',
    });
    expect(svg).toContain('&lt;div&gt;');
    expect(svg).not.toContain('<div>');
  });

  it('draws three traffic-light dots with chrome', () => {
    const { svg } = buildImageSvg(highlighted, {
      padding: 24,
      background: 'theme',
      customBackground: '',
      showChrome: true,
      title: '',
    });
    expect(svg.match(/<circle /g)?.length).toBe(3);
  });

  it('omits the chrome bar when disabled', () => {
    const { svg } = buildImageSvg(highlighted, {
      padding: 24,
      background: 'theme',
      customBackground: '',
      showChrome: false,
      title: 'x.ts',
    });
    expect(svg).not.toContain('<circle ');
    expect(svg).not.toContain('>x.ts</text>');
  });
});

describe('isLightBackground', () => {
  it('classifies light and dark hex colours', () => {
    expect(isLightBackground('#ffffff')).toBe(true);
    expect(isLightBackground('#fafafa')).toBe(true);
    expect(isLightBackground('#24292e')).toBe(false);
    expect(isLightBackground('#000000')).toBe(false);
    expect(isLightBackground('nope')).toBe(false);
  });
});

describe('svgToDataUrl', () => {
  it('produces a base64 data url', () => {
    expect(svgToDataUrl('<svg/>')).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});

describe('buildFilename', () => {
  it('sanitises the base name and appends the extension', () => {
    expect(buildFilename('My Snippet!', 'png')).toBe('My-Snippet.png');
    expect(buildFilename('code-to-image', 'svg')).toBe('code-to-image.svg');
  });

  it('falls back to a default when empty', () => {
    expect(buildFilename('  ', 'png')).toBe('code-to-image.png');
  });
});
