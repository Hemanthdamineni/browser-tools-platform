import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-to-markdown.meta';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', reg: '®',
  copy: '©', trade: '™', bull: '•', middot: '·', para: '¶',
  sect: '§', euro: '€', pound: '£', cent: '¢', yen: '¥',
  frac12: '½', frac14: '¼', frac34: '¾',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.charCodeAt(0) === 35 /* '#' */) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const num = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(num) || num < 0 || num > 0x10ffff) return match;
      try {
        return String.fromCodePoint(num);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body];
    return named !== undefined ? named : match;
  });
}

function attr(tag: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const m = re.exec(tag);
  if (!m) return '';
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

const MAX_INPUT = 200_000;

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const linkStyle = String(o.linkStyle ?? 'inline');
  const headingStyle = String(o.headingStyle ?? 'atx');

  if (!input.text) return { output: '' };
  const src = input.text;
  if (src.length > MAX_INPUT) {
    throw new ToolError('Input is too large.', `Keep it under ${MAX_INPUT.toLocaleString('en-US')} characters.`);
  }

  const refs: string[] = [];
  const addRef = (url: string): number => {
    const i = refs.indexOf(url);
    if (i !== -1) return i + 1;
    refs.push(url);
    return refs.length;
  };

  const convertInline = (t: string): string => {
    let out = t
      .replace(/<del\b[^>]*>([\s\S]*?)<\/del\s*>/gi, (_, g: string) => `~~${g}~~`)
      .replace(/<s\b[^>]*>([\s\S]*?)<\/s\s*>/gi, (_, g: string) => `~~${g}~~`)
      .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong\s*>/gi, (_, g: string) => `**${g}**`)
      .replace(/<b\b[^>]*>([\s\S]*?)<\/b\s*>/gi, (_, g: string) => `**${g}**`)
      .replace(/<em\b[^>]*>([\s\S]*?)<\/em\s*>/gi, (_, g: string) => `*${g}*`)
      .replace(/<i\b[^>]*>([\s\S]*?)<\/i\s*>/gi, (_, g: string) => `*${g}*`);
    out = out.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_whole, open: string, inner: string) => {
      const href = attr(`<a${open}>`, 'href');
      const text = inner.replace(/<[^>]+>/g, '').trim() || href;
      if (!href) return text;
      if (linkStyle === 'text') return text;
      if (linkStyle === 'reference') return `[${text}][${addRef(href)}]`;
      return `[${text}](${href})`;
    });
    out = out.replace(/<img\b[^>]*>/gi, (tag) => {
      const u = attr(tag, 'src');
      const alt = attr(tag, 'alt');
      if (linkStyle === 'text') return alt ? alt : (u ? `image: ${u}` : '');
      if (linkStyle === 'reference') return `![${alt}][${addRef(u || '')}]`;
      return `![${alt}](${u})`;
    });
    out = out.replace(/<br\s*\/?>/gi, '\n');
    return out;
  };

  let html = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:script|style)\b[^>]*>/gi, '');

  // Fenced code blocks (must precede inline <code> and generic tag strip).
  html = html.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi, (_w, inner: string) => {
    const code = inner
      .replace(/<\/?pre\b[^>]*>/gi, '')
      .replace(/<code\b[^>]*>|<\/code\s*>/gi, '')
      .replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/g, '');
    return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
  });
  html = html.replace(/<code\b[^>]*>([\s\S]*?)<\/code\s*>/gi, (_w, inner: string) => `\`${inner.replace(/<[^>]+>/g, '')}\``);

  // Global inline pass: emphasis, links, images, <br>.
  html = convertInline(html);

  // Blockquote.
  html = html.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote\s*>/gi, (_w, inner: string) => {
    const body = convertInline(inner)
      .replace(/<[^>]+>/g, '')
      .replace(/\n{2,}/g, '\n');
    return body.split('\n').map((l) => `> ${l}`.replace(/^> $/, '>')).join('\n');
  });

  // Lists (block regexes so ordered numbering resets per <ol>).
  html = html.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol\s*>/gi, (_w, inner: string) => {
    let n = 0;
    const cooked = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi, (_x, item: string) => {
      n += 1;
      return `\n${n}. ${item.trim()}`;
    });
    return `\n${cooked}\n`;
  });
  html = html.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul\s*>/gi, (_w, inner: string) => {
    const cooked = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi, (_x, item: string) => `\n- ${item.trim()}`);
    return `\n${cooked}\n`;
  });

  // Headings.
  html = html.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (whole, level: string, inner: string) => {
    const t = convertInline(inner).replace(/<[^>]+>/g, '').trim() || whole;
    const n = Number(level);
    if (headingStyle === 'setext' && n <= 2) {
      const underline = n === 1 ? '=' : '-';
      return `\n\n${t}\n${underline.repeat(Math.max(t.length, 3))}\n\n`;
    }
    return `\n\n${'#'.repeat(n)} ${t}\n\n`;
  });

  // Tables -> pipe rows.
  html = html.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  html = html.replace(/<\/?(?:table|thead|tbody|tfoot|tr|caption)\b[^>]*>/gi, '\n');
  html = html.replace(/<t[dh]\b[^>]*>(.*?)<\/t[dh]\s*>/gi, (_w, cell: string) => ` ${cell} |`);

  // Block-level spacing.
  html = html.replace(/<\/?(?:p|div|section|article|header|footer|aside|main)\b[^>]*>/gi, '\n\n');
  html = html.replace(/<[^>]+>/g, '');

  let text = decodeEntities(html);
  text = text.replace(/\r\n?/g, '\n');
  text = text
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').replace(/^ | $/g, ''))
    .join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');

  if (linkStyle === 'reference' && refs.length > 0) {
    text += `\n\n${refs.map((u, i) => `[${i + 1}]: ${u}`).join('\n')}\n`;
  }

  const headingCount = (src.match(/<h[1-6]\b/gi) ?? []).length;
  const listCount = (src.match(/<li\b/gi) ?? []).length;
  const linkCount = (src.match(/<a\b/gi) ?? []).length;

  return {
    output: text,
    render: 'code',
    stats: { headings: headingCount, lists: listCount, links: linkCount },
    notes: [linkStyle === 'reference' ? 'Links emitted as numbered references.' : 'Links emitted inline.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
