import type { FileRunResult, FileToolModule, FileRunInput, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './docx-to-markdown.meta';
import {
  attr,
  childElements,
  decodeXmlPart,
  descendants,
  elementText,
  findDescendant,
  firstElement,
  isElement,
  looksLikeOle,
  looksLikeRtf,
  looksLikeZip,
  parseXml,
  resolvePartPath,
  toggleOn,
  unzipPackage,
  type XmlElement,
} from './ooxml';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB on-disk .docx
const MAX_DOCUMENT_XML = 192 * 1024 * 1024; // decompressed word/document.xml
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // per embedded image
const MAX_IMAGES_LINK = 500;
const MAX_PREVIEW_CHARS = 100_000; // single-file inline preview cap

/* -------------------------------------------------------------------------- */
/*  Rendering model                                                           */
/* -------------------------------------------------------------------------- */

type OutputMode = 'markdown' | 'text';
type ImageMode = 'skip' | 'embed' | 'link';

interface ListBlock {
  type: 'list';
  ordered: boolean;
  level: number;
  text: string;
}
interface TextBlock {
  type: 'para' | 'heading' | 'quote';
  text: string;
  level?: number;
}
interface TableBlock {
  type: 'table';
  rows: string[][];
}
type Block = TextBlock | ListBlock | TableBlock;

interface Ctx {
  mode: OutputMode;
  escape: boolean;
  headings: boolean;
  tables: boolean;
  images: ImageMode;
  rels: Map<string, string>;
  styles: StyleResolver;
  numbering: NumberingResolver;
  pkg: Record<string, Uint8Array>;
  /** Where extracted images are written to (link mode). */
  assetsPrefix: string;
  /** zip path → output filename (link mode). */
  mediaOut: Map<string, string>;
  warnings: Set<string>;
  counters: { images: number; tables: number; headings: number; paragraphs: number };
}

/* -------------------------------------------------------------------------- */
/*  Word styles                                                               */
/* -------------------------------------------------------------------------- */

const QUOTE_STYLES = new Set([
  'quote',
  'intensequote',
  'blocktext',
  'blockquote',
  'quotation',
]);

const CODE_STYLES = new Set(['code', 'htmlcode', 'codechar', 'sourcecode', 'preformatted']);

class StyleResolver {
  private readonly styles = new Map<
    string,
    { name: string; basedOn?: string; outline?: number; numId?: string; ilvl?: string }
  >();

  static fromXml(styles?: XmlElement): StyleResolver {
    const resolver = new StyleResolver();
    if (!styles) return resolver;
    for (const style of childElements(styles, 'style')) {
      const id = attr(style, 'styleId');
      if (!id) continue;
      const type = attr(style, 'type');
      if (type && type !== 'paragraph') continue;
      const name = attr(firstElement(style, 'name'), 'val') ?? '';
      const basedOn = attr(firstElement(style, 'basedOn'), 'val');
      const pPr = firstElement(style, 'pPr');
      const outlineRaw = attr(firstElement(pPr, 'outlineLvl'), 'val');
      const outline = outlineRaw !== undefined ? Number(outlineRaw) : undefined;
      const numPr = firstElement(pPr, 'numPr');
      const numId = attr(firstElement(numPr, 'numId'), 'val');
      const ilvl = attr(firstElement(numPr, 'ilvl'), 'val');
      resolver.styles.set(id, {
        name,
        basedOn,
        outline: Number.isFinite(outline) ? outline : undefined,
        numId,
        ilvl,
      });
    }
    return resolver;
  }

  private chain(id: string): { id: string; name: string; outline?: number }[] {
    const out: { id: string; name: string; outline?: number }[] = [];
    const seen = new Set<string>();
    let current: string | undefined = id;
    for (let depth = 0; current && depth < 12 && !seen.has(current); depth++) {
      seen.add(current);
      const entry = this.styles.get(current);
      if (!entry) break;
      out.push({ id: current, name: entry.name, outline: entry.outline });
      current = entry.basedOn;
    }
    return out;
  }

  /** 1–9 when the style (or a style it inherits from) is a heading, else undefined. */
  headingLevel(styleId?: string): number | undefined {
    if (!styleId) return undefined;
    const direct = /^heading\s*([1-9])$/i.exec(styleId);
    if (direct) return Number(direct[1]);
    if (/^title$/i.test(styleId)) return 1;

    const chain = this.chain(styleId);
    for (const entry of chain) {
      const m = /^heading\s*([1-9])/i.exec(entry.name.trim());
      if (m) return Number(m[1]);
      if (/^title$/i.test(entry.name.trim())) return 1;
    }
    for (const entry of chain) {
      // Word stores outline levels 0-based; 9 means "body text" (no heading).
      if (entry.outline !== undefined && entry.outline >= 0 && entry.outline <= 8) {
        return entry.outline + 1;
      }
    }
    return undefined;
  }

  isQuote(styleId?: string): boolean {
    if (!styleId) return false;
    if (QUOTE_STYLES.has(styleId.toLowerCase().replace(/\s+/g, ''))) return true;
    for (const entry of this.chain(styleId)) {
      const id = entry.id.toLowerCase();
      const name = entry.name.toLowerCase().replace(/\s+/g, '');
      if (QUOTE_STYLES.has(id) || QUOTE_STYLES.has(name)) return true;
    }
    return false;
  }

  isCode(styleId?: string): boolean {
    if (!styleId) return false;
    return CODE_STYLES.has(styleId.toLowerCase().replace(/\s+/g, ''));
  }

  styleNumPr(styleId?: string): { numId?: string; ilvl?: string } | undefined {
    if (!styleId) return undefined;
    let current: string | undefined = styleId;
    const seen = new Set<string>();
    for (let depth = 0; current && depth < 12 && !seen.has(current); depth++) {
      seen.add(current);
      const entry = this.styles.get(current);
      if (!entry) break;
      if (entry.numId && entry.numId !== '0') return { numId: entry.numId, ilvl: entry.ilvl };
      current = entry.basedOn;
    }
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/*  Word numbering                                                            */
/* -------------------------------------------------------------------------- */

class NumberingResolver {
  private readonly numToAbstract = new Map<string, string>();
  private readonly abstractFmt = new Map<string, Map<string, string>>();

  static fromXml(numbering?: XmlElement): NumberingResolver {
    const resolver = new NumberingResolver();
    if (!numbering) return resolver;
    for (const num of childElements(numbering, 'num')) {
      const numId = attr(num, 'numId');
      const abstractId = attr(firstElement(num, 'abstractNumId'), 'val');
      if (numId && abstractId) resolver.numToAbstract.set(numId, abstractId);
    }
    for (const abstract of childElements(numbering, 'abstractNum')) {
      const abstractId = attr(abstract, 'abstractNumId');
      if (!abstractId) continue;
      const formats = new Map<string, string>();
      for (const lvl of childElements(abstract, 'lvl')) {
        const ilvl = attr(lvl, 'ilvl') ?? '0';
        const fmt = attr(firstElement(lvl, 'numFmt'), 'val') ?? 'bullet';
        formats.set(ilvl, fmt);
      }
      resolver.abstractFmt.set(abstractId, formats);
    }
    return resolver;
  }

  /** `true` when the level renders an incrementing number rather than a bullet. */
  isOrdered(numId?: string, ilvl?: string): boolean {
    if (!numId) return false;
    const abstractId = this.numToAbstract.get(numId);
    if (!abstractId) return false;
    const formats = this.abstractFmt.get(abstractId);
    if (!formats) return false;
    const fmt = formats.get(ilvl ?? '0') ?? formats.get('0');
    if (!fmt) return false;
    return fmt !== 'bullet' && fmt !== 'none' && fmt !== '';
  }
}

/* -------------------------------------------------------------------------- */
/*  Inline rendering                                                          */
/* -------------------------------------------------------------------------- */

const MD_SPECIAL = new Set(['\\', '`', '*', '_', '[', ']', '<', '>']);

function escapeMd(text: string): string {
  let out = '';
  for (const ch of text) out += MD_SPECIAL.has(ch) ? `\\${ch}` : ch;
  return out;
}

/** Wrap text in a code span using a fence long enough to survive inner backticks. */
function codeSpan(text: string): string {
  const runs = text.match(/`+/g);
  const longest = runs ? Math.max(...runs.map((r) => r.length)) : 0;
  const delim = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${delim}${pad}${text}${pad}${delim}`;
}

function escapeAlt(alt: string): string {
  return alt.replace(/([\\[\]<>])/g, '\\$1').replace(/\s+/g, ' ').trim();
}

function escapeUrl(url: string): string {
  return /[\s()<>]/.test(url) ? `<${url.replace(/[<>]/g, '')}>` : url;
}

function imageMime(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'emf':
      return 'image/emf';
    case 'wmf':
      return 'image/wmf';
    default:
      return 'application/octet-stream';
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface RunFlags {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  vertAlign?: string;
  code: boolean;
}

function runFlags(rPr: XmlElement | undefined, ctx: Ctx): RunFlags {
  const rStyle = attr(firstElement(rPr, 'rStyle'), 'val');
  return {
    bold: toggleOn(firstElement(rPr, 'b')),
    italic: toggleOn(firstElement(rPr, 'i')),
    strike: toggleOn(firstElement(rPr, 'strike')) || toggleOn(firstElement(rPr, 'dstrike')),
    vertAlign: attr(firstElement(rPr, 'vertAlign'), 'val'),
    code: ctx.styles.isCode(rStyle),
  };
}

function renderRun(run: XmlElement, ctx: Ctx): string {
  const flags = runFlags(firstElement(run, 'rPr'), ctx);
  const markdown = ctx.mode === 'markdown';
  // Escape literal text only. Generated markup (images) must pass through raw,
  // otherwise its `[]`/`()` brackets would be escaped.
  const esc = (value: string) => (markdown && ctx.escape && !flags.code ? escapeMd(value) : value);
  let text = '';
  for (const child of run.children) {
    if (!isElement(child)) {
      if (child.text.trim()) text += esc(child.text);
      continue;
    }
    switch (child.local) {
      case 't':
        text += esc(elementText(child));
        break;
      case 'tab':
        text += '\t';
        break;
      case 'br':
      case 'cr':
        text += markdown ? '  \n' : '\n';
        break;
      case 'noBreakHyphen':
        text += '-';
        break;
      case 'softHyphen':
        text += '\u00ad';
        break;
      case 'sym': {
        const code = attr(child, 'char');
        if (code) text += esc(String.fromCodePoint(Number.parseInt(code, 16) || 0x20));
        break;
      }
      case 'drawing':
      case 'pict':
        text += renderImage(child, ctx);
        break;
      case 'delText':
      case 'instrText':
      case 'annotationRef':
      case 'footnoteRef':
      case 'endnoteRef':
      case 'footnoteReference':
      case 'endnoteReference':
      case 'rPr':
      case 'lastRenderedPageBreak':
        break;
      default:
        if (child.children.length) text += esc(elementText(child));
    }
  }
  if (!text) return '';
  if (!markdown) return text;

  if (flags.code) return codeSpan(text);
  let out = text;
  if (flags.vertAlign === 'superscript') out = `<sup>${out}</sup>`;
  else if (flags.vertAlign === 'subscript') out = `<sub>${out}</sub>`;
  if (flags.strike) out = `~~${out}~~`;
  if (flags.italic) out = `*${out}*`;
  if (flags.bold) out = `**${out}**`;
  return out;
}

function renderImage(container: XmlElement, ctx: Ctx): string {
  ctx.counters.images++;
  const blip = findDescendant(container, 'blip');
  const imagedata = findDescendant(container, 'imagedata');
  const rId = (blip ? attr(blip, 'embed') ?? attr(blip, 'link') : undefined) ?? (imagedata ? attr(imagedata, 'id') : undefined);
  const docPr = findDescendant(container, 'docPr');
  const alt = (docPr ? attr(docPr, 'descr') ?? attr(docPr, 'title') ?? attr(docPr, 'name') : undefined) ?? '';

  if (ctx.images === 'skip') return '';
  if (ctx.mode === 'text') return alt ? `[Image: ${alt}]` : '[Image]';
  if (!rId) return '';

  const target = ctx.rels.get(rId);
  if (!target) return '';

  const external = /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//');
  if (external) {
    return `![${escapeAlt(alt)}](${escapeUrl(target)})`;
  }

  const partPath = resolvePartPath('word', target);
  const data = ctx.pkg[partPath];
  if (!data) return '';

  if (ctx.images === 'embed') {
    if (data.length > MAX_IMAGE_BYTES) {
      ctx.warnings.add('Some images were too large to embed and were skipped.');
      return '';
    }
    return `![${escapeAlt(alt)}](data:${imageMime(partPath)};base64,${toBase64(data)})`;
  }

  // link mode — record the extracted file and reference it.
  let outName = ctx.mediaOut.get(partPath);
  if (!outName) {
    if (ctx.mediaOut.size >= MAX_IMAGES_LINK) {
      ctx.warnings.add('Only the first 500 images were extracted.');
      return '';
    }
    const filename = partPath.slice(partPath.lastIndexOf('/') + 1);
    outName = `${ctx.assetsPrefix}${filename}`;
    ctx.mediaOut.set(partPath, outName);
  }
  return `![${escapeAlt(alt)}](${encodeURI(outName)})`;
}

function renderHyperlink(link: XmlElement, ctx: Ctx): string {
  const inner = renderInline(link, ctx);
  if (!inner) return '';
  if (ctx.mode === 'text') return inner;
  const rId = attr(link, 'id');
  const anchor = attr(link, 'anchor');
  let url = rId ? ctx.rels.get(rId) : undefined;
  if (url && anchor && !url.includes('#')) url = `${url}#${anchor}`;
  if (!url && anchor) url = `#${anchor}`;
  if (!url) return inner;
  return `[${inner}](${escapeUrl(url)})`;
}

function renderInline(container: XmlElement, ctx: Ctx): string {
  let out = '';
  for (const child of container.children) {
    if (!isElement(child)) {
      // Ignore whitespace that some producers put between elements; significant
      // text always lives inside a <w:t>, which is handled by renderRun.
      if (!child.text.trim()) continue;
      out += ctx.mode === 'markdown' && ctx.escape ? escapeMd(child.text) : child.text;
      continue;
    }
    switch (child.local) {
      case 'r':
        out += renderRun(child, ctx);
        break;
      case 'hyperlink':
        out += renderHyperlink(child, ctx);
        break;
      case 'del':
      case 'moveFrom':
      case 'pPr':
      case 'rPr':
      case 'tbl':
        break;
      default:
        // Transparent containers: w:ins, w:smartTag, w:sdt, w:fldSimple, …
        if (child.children.length) out += renderInline(child, ctx);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Block building                                                            */
/* -------------------------------------------------------------------------- */

function normaliseParagraphText(text: string): string {
  // Collapse the hard-break padding + stray trailing whitespace, keep inner breaks.
  return text.replace(/[ \t]+$/g, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function guardBlockStart(text: string): string {
  if (/^#{1,6}\s/.test(text)) return `\\${text}`;
  if (/^>/.test(text)) return `\\${text}`;
  if (/^[-+]\s/.test(text)) return `\\${text}`;
  if (/^\d+[.)]\s/.test(text)) return text.replace(/^(\d+)([.)])/, '$1\\$2');
  return text;
}

function makeParagraph(p: XmlElement, ctx: Ctx): Block | undefined {
  const pPr = firstElement(p, 'pPr');
  const styleId = attr(firstElement(pPr, 'pStyle'), 'val');
  let text = normaliseParagraphText(renderInline(p, ctx));
  if (!text) return undefined;
  ctx.counters.paragraphs++;

  const headingLevel = ctx.headings ? ctx.styles.headingLevel(styleId) : undefined;
  if (headingLevel) {
    ctx.counters.headings++;
    return { type: 'heading', level: headingLevel, text };
  }

  let numId = attr(firstElement(firstElement(pPr, 'numPr'), 'numId'), 'val');
  let ilvl = attr(firstElement(firstElement(pPr, 'numPr'), 'ilvl'), 'val');
  if ((!numId || numId === '0') && styleId) {
    const fromStyle = ctx.styles.styleNumPr(styleId);
    if (fromStyle?.numId) {
      numId = fromStyle.numId;
      ilvl = fromStyle.ilvl ?? ilvl;
    }
  }
  if (numId && numId !== '0') {
    const level = Math.max(0, Math.min(8, Number(ilvl ?? '0') || 0));
    return { type: 'list', ordered: ctx.numbering.isOrdered(numId, ilvl), level, text };
  }

  if (ctx.styles.isQuote(styleId)) return { type: 'quote', text };

  if (ctx.mode === 'markdown' && ctx.escape) text = guardBlockStart(text);
  return { type: 'para', text };
}

function cellText(cell: XmlElement, ctx: Ctx): string {
  const parts: string[] = [];
  for (const child of childElements(cell)) {
    if (child.local === 'p') parts.push(renderInline(child, ctx));
    else if (child.local === 'tbl') {
      // Flatten a nested table into tab-separated text.
      for (const row of childElements(child, 'tr')) {
        const cells = childElements(row, 'tc').map((tc) => renderInline(tc, ctx).replace(/\s+/g, ' ').trim());
        parts.push(cells.join('\t'));
      }
    }
  }
  return parts.filter((part) => part.trim()).join('\n').trim();
}

function makeTable(tbl: XmlElement, ctx: Ctx): Block | undefined {
  ctx.counters.tables++;
  const rows: string[][] = [];
  for (const tr of childElements(tbl, 'tr')) {
    const cells: string[] = [];
    for (const tc of childElements(tr, 'tc')) {
      const tcPr = firstElement(tc, 'tcPr');
      const span = Math.max(1, Number(attr(firstElement(tcPr, 'gridSpan'), 'val') ?? '1') || 1);
      const vMergeEl = firstElement(tcPr, 'vMerge');
      const vMerge = vMergeEl ? attr(vMergeEl, 'val') ?? 'continue' : undefined;
      cells.push(vMerge === 'continue' ? '' : cellText(tc, ctx));
      for (let s = 1; s < span; s++) cells.push('');
    }
    rows.push(cells);
  }
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (width === 0) return undefined;
  for (const row of rows) while (row.length < width) row.push('');
  return { type: 'table', rows };
}

function walkBlocks(container: XmlElement, ctx: Ctx, out: Block[]): void {
  for (const child of childElements(container)) {
    switch (child.local) {
      case 'p': {
        const block = makeParagraph(child, ctx);
        if (block) out.push(block);
        break;
      }
      case 'tbl': {
        if (ctx.tables) {
          const table = makeTable(child, ctx);
          if (table) out.push(table);
        } else {
          ctx.warnings.add('Tables were skipped because the "Convert tables" option is off.');
        }
        break;
      }
      case 'sdt': {
        const content = firstElement(child, 'sdtContent');
        if (content) walkBlocks(content, ctx, out);
        break;
      }
      case 'sdtContent':
        walkBlocks(child, ctx, out);
        break;
      default:
        break; // sectPr, bookmarks, proofing marks, etc.
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Block rendering                                                           */
/* -------------------------------------------------------------------------- */

function markdownCell(cell: string): string {
  return cell.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').trim();
}

function renderMarkdown(blocks: Block[]): string {
  let out = '';
  let previous: Block['type'] | '' = '';
  for (const block of blocks) {
    let rendered = '';
    switch (block.type) {
      case 'heading':
        rendered = `${'#'.repeat(Math.max(1, Math.min(6, block.level ?? 1)))} ${block.text}`;
        break;
      case 'quote':
        rendered = block.text
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
        break;
      case 'list':
        rendered = `${'  '.repeat(block.level)}${block.ordered ? '1.' : '-'} ${block.text.replace(/\n/g, `\n${'  '.repeat(block.level + 1)}`)}`;
        break;
      case 'table': {
        const [header = [], ...body] = block.rows;
        const lines = [
          `| ${header.map(markdownCell).join(' | ')} |`,
          `| ${header.map(() => '---').join(' | ')} |`,
          ...body.map((row) => `| ${row.map(markdownCell).join(' | ')} |`),
        ];
        rendered = lines.join('\n');
        break;
      }
      default:
        rendered = block.text;
    }
    if (!rendered) continue;
    // Consecutive list items are joined by a single newline so the list stays
    // tight; any other block boundary starts a fresh paragraph.
    if (out) out += previous === 'list' && block.type === 'list' ? '\n' : '\n\n';
    out += rendered;
    previous = block.type;
  }
  return out;
}

function renderText(blocks: Block[]): string {
  let out = '';
  let previous: Block['type'] | '' = '';
  const counters: number[] = [];
  for (const block of blocks) {
    let rendered = '';
    if (block.type === 'list') {
      const level = block.level;
      counters.length = level + 1;
      counters[level] = (counters[level] ?? 0) + 1;
      const marker = block.ordered ? `${counters[level]}.` : '-';
      rendered = `${'  '.repeat(level)}${marker} ${block.text.replace(/\n/g, ' ')}`;
    } else {
      counters.length = 0;
      if (block.type === 'table') {
        rendered = block.rows.map((row) => row.map((c) => c.replace(/\r?\n/g, ' ')).join('\t')).join('\n');
      } else {
        rendered = block.text.replace(/\n/g, ' ').trim();
      }
    }
    if (!rendered) continue;
    if (out) out += block.type === 'table' || previous === 'table' ? '\n\n' : '\n';
    out += rendered;
    previous = block.type;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Package reading                                                           */
/* -------------------------------------------------------------------------- */

function isSmallPart(name: string): boolean {
  return (
    name === 'word/document.xml' ||
    name === 'word/styles.xml' ||
    name === 'word/numbering.xml' ||
    name === 'word/_rels/document.xml.rels' ||
    name === 'xl/workbook.xml' ||
    name === 'ppt/presentation.xml' ||
    name === 'content.xml' ||
    name === 'mimetype' ||
    name === '[content_types].xml'
  );
}

function stripExtension(name: string): string {
  const base = name.slice(name.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base).trim() || 'document';
}

/**
 * `parseXml` returns an artificial `#root` wrapper; the real document element
 * (`w:styles`, `w:numbering`, …) is its first element child. Resolvers that walk
 * direct children need that element, not the wrapper.
 */
function rootElement(doc: XmlElement): XmlElement {
  return childElements(doc)[0] ?? doc;
}

function uniqueName(used: Set<string>, desired: string): string {
  if (!used.has(desired)) {
    used.add(desired);
    return desired;
  }
  const dot = desired.lastIndexOf('.');
  const stem = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

function validateBytes(bytes: Uint8Array, name: string): void {
  if (looksLikeOle(bytes)) {
    throw new ToolError(
      `"${name}" is a legacy binary Word document (.doc).`,
      'Open it in Word or LibreOffice and save it as .docx, then try again.',
    );
  }
  if (looksLikeRtf(bytes)) {
    throw new ToolError(
      `"${name}" is an RTF document, not a .docx.`,
      'Save it as .docx (or paste the text) and try again.',
    );
  }
  if (!looksLikeZip(bytes)) {
    throw new ToolError(
      `"${name}" does not look like a Word .docx file.`,
      'A .docx is a ZIP package. Check that the file is not corrupt and has the right extension.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  run()                                                                     */
/* -------------------------------------------------------------------------- */

interface ConvertedFile {
  blocks: Block[];
  warnings: Set<string>;
  images: number;
  tables: number;
  headings: number;
  paragraphs: number;
  /** Extracted media files (link mode): output filename + bytes. */
  media: { outName: string; data: Uint8Array }[];
}

function convertDocument(
  file: File,
  bytes: Uint8Array,
  mode: OutputMode,
  images: ImageMode,
  headings: boolean,
  tables: boolean,
  escape: boolean,
  assetsPrefix: string,
): ConvertedFile {
  validateBytes(bytes, file.name);

  const pkg = unzipPackage(bytes, (name) => isSmallPart(name) || (images !== 'skip' && name.startsWith('word/media/')));

  const documentXml = pkg['word/document.xml'];
  if (!documentXml) {
    if (pkg['xl/workbook.xml']) {
      throw new ToolError(
        `"${file.name}" is an Excel workbook (.xlsx), not a Word document.`,
        'This tool only reads Word .docx files.',
      );
    }
    if (pkg['ppt/presentation.xml']) {
      throw new ToolError(
        `"${file.name}" is a PowerPoint presentation (.pptx), not a Word document.`,
        'This tool only reads Word .docx files.',
      );
    }
    if (pkg['content.xml'] || pkg['mimetype']) {
      throw new ToolError(
        `"${file.name}" looks like an OpenDocument file (.odt), which is not supported yet.`,
        'Save it as .docx in LibreOffice (File → Save As → Word 2007-365) and try again.',
      );
    }
    throw new ToolError(
      `"${file.name}" does not contain a readable Word document part.`,
      'The file may be corrupt or not a real .docx.',
    );
  }
  if (documentXml.length > MAX_DOCUMENT_XML) {
    throw new ToolError(
      `"${file.name}" expands to a document that is too large to process.`,
      'Try splitting the document into smaller files.',
    );
  }

  const document = parseXml(decodeXmlPart(documentXml));
  const body = findDescendant(document, 'body');
  if (!body) {
    throw new ToolError(
      `"${file.name}" has no document body.`,
      'The .docx package looks incomplete or corrupt.',
    );
  }

  const rels = new Map<string, string>();
  const relsBytes = pkg['word/_rels/document.xml.rels'];
  if (relsBytes) {
    const relsDoc = parseXml(decodeXmlPart(relsBytes));
    for (const rel of descendants(relsDoc, 'Relationship')) {
      const id = attr(rel, 'Id');
      const target = attr(rel, 'Target');
      if (id && target) rels.set(id, target);
    }
  }

  const styles = StyleResolver.fromXml(
    pkg['word/styles.xml'] ? rootElement(parseXml(decodeXmlPart(pkg['word/styles.xml']))) : undefined,
  );
  const numbering = NumberingResolver.fromXml(
    pkg['word/numbering.xml']
      ? rootElement(parseXml(decodeXmlPart(pkg['word/numbering.xml'])))
      : undefined,
  );

  const warnings = new Set<string>();
  const mediaOut = new Map<string, string>();
  const ctx: Ctx = {
    mode,
    escape,
    headings,
    tables,
    images,
    rels,
    styles,
    numbering,
    pkg,
    assetsPrefix,
    mediaOut,
    warnings,
    counters: { images: 0, tables: 0, headings: 0, paragraphs: 0 },
  };

  const blocks: Block[] = [];
  walkBlocks(body, ctx, blocks);

  const media: { outName: string; data: Uint8Array }[] = [];
  for (const [partPath, outName] of mediaOut) {
    const data = pkg[partPath];
    if (data) media.push({ outName, data });
  }

  return {
    blocks,
    warnings,
    images: ctx.counters.images,
    tables: ctx.counters.tables,
    headings: ctx.counters.headings,
    paragraphs: ctx.counters.paragraphs,
    media,
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose a Word .docx file to convert.');

  const mode: OutputMode = String(options.output) === 'text' ? 'text' : 'markdown';
  const images: ImageMode =
    options.images === 'embed' || options.images === 'link' ? (options.images as ImageMode) : 'skip';
  const headings = options.headings !== false;
  const tables = options.tables !== false;
  const escape = options.escape !== false;

  const outputs: OutputFile[] = [];
  const reportRows: string[][] = [];
  const notes = new Set<string>();
  const warnings = new Set<string>();
  const usedNames = new Set<string>();
  let singleReport: FileRunResult['report'] | undefined;
  const totalStats = { words: 0, characters: 0, paragraphs: 0, tables: 0, headings: 0, images: 0 };

  for (let index = 0; index < files.length; index++) {
    const file = files[index] as File;
    if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
    const slice = index / files.length;

    onProgress?.(slice + 0.02, files.length > 1 ? `Reading ${file.name}` : 'Reading file');
    if (file.size > MAX_FILE_BYTES) {
      throw new ToolError(
        `"${file.name}" is too large to convert in the browser (limit 50 MB).`,
        'Try splitting the document or removing embedded media.',
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());

    onProgress?.(slice + 0.2, files.length > 1 ? `Unpacking ${file.name}` : 'Unpacking document');
    const base = stripExtension(file.name);
    // Reserve a unique stem up front so the .md/.txt and its `<stem>.assets/`
    // image folder never collide when several inputs share a file name.
    const stem = uniqueName(usedNames, base);
    const assetsPrefix = `${stem}.assets/`;
    const converted = convertDocument(
      file,
      bytes,
      mode,
      images,
      headings,
      tables,
      escape,
      assetsPrefix,
    );

    onProgress?.(slice + 0.7, files.length > 1 ? `Rendering ${file.name}` : 'Rendering output');
    const rendered = mode === 'text' ? renderText(converted.blocks) : renderMarkdown(converted.blocks);
    const text = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

    if (!rendered.trim()) {
      warnings.add(`"${file.name}" produced no text (it may be empty, or only contain unsupported objects).`);
    }
    for (const warning of converted.warnings) warnings.add(warning);

    const outputName = `${stem}.${mode === 'text' ? 'txt' : 'md'}`;
    outputs.push({
      filename: outputName,
      blob: new Blob([text], {
        type: mode === 'text' ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8',
      }),
    });

    if (images === 'link') {
      for (const { outName, data } of converted.media) {
        outputs.push({ filename: outName, blob: new Blob([data.slice().buffer as ArrayBuffer]) });
      }
    }

    const words = rendered.split(/\s+/).filter(Boolean).length;
    totalStats.words += words;
    totalStats.characters += rendered.length;
    totalStats.paragraphs += converted.paragraphs;
    totalStats.tables += converted.tables;
    totalStats.headings += converted.headings;
    totalStats.images += converted.images;

    if (files.length === 1) {
      let preview = rendered;
      if (preview.length > MAX_PREVIEW_CHARS) {
        preview = preview.slice(0, MAX_PREVIEW_CHARS);
        notes.add('The inline preview is truncated — download the file to see the full output.');
      }
      singleReport = {
        output: preview,
        render: 'code',
        language: mode === 'text' ? 'text' : 'markdown',
      };
    } else {
      reportRows.push([
        file.name,
        outputName,
        `${words}`,
        `${converted.paragraphs}`,
        `${converted.tables}`,
        `${converted.headings}`,
        `${converted.images}`,
      ]);
    }
  }

  onProgress?.(1, 'Done');

  if (images === 'skip' && totalStats.images > 0) {
    notes.add(`${totalStats.images} image(s) were skipped — choose "Extract & link" or "Embed" to include them.`);
  }
  if (images === 'link' && totalStats.images > 0) {
    notes.add(
      'Images were extracted into a "<name>.assets/" folder — use "Download all (.zip)" so the folder and the links in the document stay together.',
    );
  }
  if (mode === 'markdown' && !escape) {
    notes.add('Markdown escaping is off, so special characters in the document are written literally.');
  }

  const result: FileRunResult = {
    outputs,
    stats: {
      documents: files.length,
      words: totalStats.words,
      characters: totalStats.characters,
      paragraphs: totalStats.paragraphs,
      headings: totalStats.headings,
      tables: totalStats.tables,
      images: totalStats.images,
    },
    notes: notes.size ? [...notes] : undefined,
    warnings: warnings.size ? [...warnings] : undefined,
  };

  if (singleReport) {
    result.report = singleReport;
  } else if (reportRows.length) {
    result.report = {
      output: JSON.stringify({
        headers: ['File', 'Output', 'Words', 'Paragraphs', 'Tables', 'Headings', 'Images'],
        rows: reportRows,
      }),
      render: 'table',
    };
  }

  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
