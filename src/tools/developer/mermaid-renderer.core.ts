/**
 * Pure Mermaid rendering logic.
 */
import mermaid from 'mermaid';
import type { OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {},
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

export interface MermaidRenderOptions {
  theme: string;
  scale: number;
  showControls: boolean;
}

export function resolveOptions(values: OptionValues): MermaidRenderOptions {
  const theme = values.theme ?? 'default';
  const scale = Number(values.scale ?? 1);
  const showControls = values.showControls !== undefined ? Boolean(values.showControls) : true;

  if (scale < 0.1 || scale > 5) {
    throw new ToolError('Scale must be between 0.1 and 5');
  }

  return { theme, scale, showControls };
}

/**
 * Render Mermaid source to SVG (and optionally PNG).
 */
export async function renderMermaid(
  source: string,
  options: MermaidRenderOptions,
): Promise<{ svg: string; png?: string }> {
  if (!source.trim()) {
    throw new ToolError('Mermaid source cannot be empty');
  }

  // Render to SVG
  const { svg } = await mermaid.render('mermaid-diagram', source);

  let png: string | undefined;
  if (options.scale > 0.01) {
    try {
      png = await svgToPng(svg, options.scale);
    } catch (e) {
      // Fall back to SVG-only if rasterization fails
    }
  }

  return { svg, png };
}

/**
 * Convert SVG string to PNG data URL using a canvas.
 */
async function svgToPng(svg: string, scale: number): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new ToolError('Failed to rasterize SVG to PNG'));

    // Set SVG content as data URL
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
    // Clean up URL after load
    img.onload = () => {
      URL.revokeObjectURL(url);
      img.onload = null; // avoid multiple calls
    };
  });
}
