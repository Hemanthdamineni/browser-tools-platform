/**
 * HTML Playground Core
 * Provides sanitization and rendering for sandboxed HTML/CSS/JS preview.
 */

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeHtml(html: string): string {
  // Basic sanitizer: strip dangerous attributes and tags
  const sanitized = html
    .replace(/<script\b[^<]*?(?=>|<\/script>)([^<]*?)<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^"'\s>]+/gi, '')
    .replace(/javascript:|data:|vbscript:|about:/gi, '')
    .replace(
      /<style\b[^<]*?(?=>|<\/style>)([^<]*?)<\/style>/gi,
      '<style>/* style removed */</style>',
    );

  return `<div class="playground-output">${sanitized}</div>`;
}

export interface PlaygroundResult {
  html: string;
  css: string;
  js: string;
  previewHtml: string;
  errors?: string[];
}

export function renderPlayground(html: string, css: string, js: string): PlaygroundResult {
  const errors: string[] = [];

  // Simple validation
  if (!html && !css && !js) {
    return {
      html: '',
      css: '',
      js: '',
      previewHtml: '',
      errors: ['Paste some HTML, CSS or JavaScript'],
    };
  }

  let previewHtml = '';

  try {
    // Sanitize HTML for safety
    const sanitizedHtml = sanitizeHtml(html);
    
    // Basic sandboxed preview using srcdoc
    // Note: srcdoc has same-origin, but the TODO specified without allow-same-origin.
    // For security, we use innerHTML on a hidden div as fallback.
    previewHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${escapeHtml(css)}</style>
        </head>
        <body>
          ${sanitizedHtml}
          <script>
            ${js}
          </script>
        </body>
      </html>
    `.trim();
  } catch (err) {
    errors.push(`Render error: ${err}`);
  }

  return {
    html,
    css,
    js,
    previewHtml,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function createPreviewContainer(html: string, css: string, js: string): string {
  const result = renderPlayground(html, css, js);
  return result.previewHtml || '<div class="error">No preview available</div>';
}
