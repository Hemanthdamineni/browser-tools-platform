import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './web-manifest.meta';

type Issue = { level: 'Error' | 'Recommendation'; field: string; message: string };
type Manifest = Record<string, unknown>;
const DISPLAY_VALUES = new Set(['fullscreen', 'standalone', 'minimal-ui', 'browser']);

function validate(value: unknown): Issue[] {
  const issues: Issue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ level: 'Error', field: 'root', message: 'Manifest must be a JSON object.' }];
  }
  const manifest = value as Manifest;
  for (const field of ['name', 'short_name'] as const) {
    if (manifest[field] !== undefined && typeof manifest[field] !== 'string') {
      issues.push({ level: 'Error', field, message: 'Must be a string.' });
    }
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    issues.push({
      level: 'Recommendation',
      field: 'name',
      message: 'Add a non-empty application name.',
    });
  }
  if (typeof manifest.short_name !== 'string' || !manifest.short_name.trim()) {
    issues.push({
      level: 'Recommendation',
      field: 'short_name',
      message: 'Add a short_name for constrained display contexts.',
    });
  }
  if (manifest.start_url !== undefined && typeof manifest.start_url !== 'string') {
    issues.push({ level: 'Error', field: 'start_url', message: 'Must be a string.' });
  } else if (typeof manifest.start_url !== 'string' || !manifest.start_url.trim()) {
    issues.push({
      level: 'Recommendation',
      field: 'start_url',
      message: 'Set a start_url for app launch.',
    });
  }
  if (manifest.scope !== undefined && typeof manifest.scope !== 'string') {
    issues.push({ level: 'Error', field: 'scope', message: 'Must be a string.' });
  }
  if (
    manifest.display !== undefined &&
    (typeof manifest.display !== 'string' || !DISPLAY_VALUES.has(manifest.display))
  ) {
    issues.push({
      level: 'Error',
      field: 'display',
      message: 'Use fullscreen, standalone, minimal-ui, or browser.',
    });
  }
  for (const field of ['theme_color', 'background_color'] as const) {
    if (
      manifest[field] !== undefined &&
      (typeof manifest[field] !== 'string' || !manifest[field].trim())
    ) {
      issues.push({ level: 'Error', field, message: 'Must be a non-empty string when provided.' });
    }
  }
  if (manifest.icons !== undefined) {
    if (!Array.isArray(manifest.icons)) {
      issues.push({ level: 'Error', field: 'icons', message: 'Must be an array of icon objects.' });
    } else {
      let has192 = false;
      let has512 = false;
      manifest.icons.forEach((icon, index) => {
        const field = `icons[${index}]`;
        if (!icon || typeof icon !== 'object' || Array.isArray(icon)) {
          issues.push({ level: 'Error', field, message: 'Must be an object.' });
          return;
        }
        const item = icon as Manifest;
        for (const required of ['src', 'sizes', 'type']) {
          if (typeof item[required] !== 'string' || !String(item[required]).trim()) {
            issues.push({
              level: 'Error',
              field: `${field}.${required}`,
              message: 'Must be a non-empty string.',
            });
          }
        }
        const sizes = typeof item.sizes === 'string' ? item.sizes.split(/\s+/) : [];
        if (sizes.some((size) => /^192x192$/i.test(size))) has192 = true;
        if (sizes.some((size) => /^512x512$/i.test(size))) has512 = true;
        if (
          typeof item.purpose === 'string' &&
          !item.purpose
            .split(/\s+/)
            .every((purpose) => ['any', 'maskable', 'monochrome'].includes(purpose))
        ) {
          issues.push({
            level: 'Error',
            field: `${field}.purpose`,
            message: 'Use any, maskable, and/or monochrome.',
          });
        }
      });
      if (!manifest.icons.length)
        issues.push({
          level: 'Recommendation',
          field: 'icons',
          message: 'Add icons for application installation and launcher display.',
        });
      else {
        if (!has192)
          issues.push({
            level: 'Recommendation',
            field: 'icons',
            message: 'Include a 192x192 icon.',
          });
        if (!has512)
          issues.push({
            level: 'Recommendation',
            field: 'icons',
            message: 'Include a 512x512 icon.',
          });
      }
    }
  } else {
    issues.push({
      level: 'Recommendation',
      field: 'icons',
      message: 'Add icons appropriate to target browsers and installation surfaces.',
    });
  }
  return issues;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'generate' && mode !== 'validate')
    throw new ToolError('Choose a valid manifest mode.');

  let manifest: Manifest;
  if (mode === 'generate') {
    const display = String(options.display);
    if (!DISPLAY_VALUES.has(display)) throw new ToolError('Choose a supported display mode.');
    const name = String(options.name).trim();
    const shortName = String(options.shortName).trim();
    const startUrl = String(options.startUrl).trim();
    const themeColor = String(options.themeColor).trim();
    const backgroundColor = String(options.backgroundColor).trim();
    const scope = String(options.scope).trim();
    if (!name || !shortName) throw new ToolError('App name and short name are required.');
    if (!startUrl || /[\r\n]/.test(startUrl))
      throw new ToolError('Start URL is required and must be on one line.');
    manifest = {
      name,
      short_name: shortName,
      start_url: startUrl,
      display,
      ...(themeColor ? { theme_color: themeColor } : {}),
      ...(backgroundColor ? { background_color: backgroundColor } : {}),
      ...(scope ? { scope } : {}),
    };
  } else {
    if (input.text.length > 200_000)
      throw new ToolError('Manifest JSON is too large.', 'Paste JSON under 200 KB.');
    try {
      manifest = JSON.parse(input.text) as Manifest;
    } catch {
      throw new ToolError('Manifest is not valid JSON.', 'Check quotes, commas, and braces.');
    }
  }

  const issues = validate(manifest);
  const rows = issues.map((issue) => [issue.level, issue.field, issue.message]);
  const errors = issues.filter((issue) => issue.level === 'Error').length;
  const recommendations = issues.length - errors;
  return {
    output: JSON.stringify(manifest, null, 2),
    render: 'code',
    language: 'json',
    filename: 'site.webmanifest',
    stats: { errors, recommendations },
    notes: [
      issues.length
        ? JSON.stringify({ headers: ['Level', 'Field', 'Message'], rows })
        : 'No structural issues or recommendations found.',
      'Validation is advisory; browser installability also depends on page configuration, delivery, icons, security context, and browser-specific requirements.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
