import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-inspector.meta';

const CODE_POINT_NAMES: Record<number, string> = {
  0x00ad: 'soft hyphen', 0x034f: 'combining grapheme joiner', 0x061c: 'Arabic letter mark',
  0x115f: 'hangul choseong filler', 0x1160: 'hangul jungseong filler',
  0x17b4: 'khmer vowel inherent aq', 0x17b5: 'khmer vowel inherent aa',
  0x180e: 'Mongolian vowel separator', 0x200b: 'zero-width space', 0x200c: 'zero-width non-joiner',
  0x200d: 'zero-width joiner', 0x200e: 'left-to-right mark', 0x200f: 'right-to-left mark',
  0x202a: 'left-to-right embedding', 0x202b: 'right-to-left embedding',
  0x202c: 'pop directional formatting', 0x202d: 'left-to-right override',
  0x202e: 'right-to-left override', 0x2060: 'word joiner', 0x2066: 'left-to-right isolate',
  0x2067: 'right-to-left isolate', 0x2068: 'first strong isolate', 0x2069: 'pop directional isolate',
  0x3000: 'ideographic space', 0xfeff: 'byte-order mark / zero-width no-break space',
};

const hex = (value: number, width = 4) => value.toString(16).toUpperCase().padStart(width, '0');

function lineEndings(text: string): { crlf: number; lf: number; cr: number } {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const cr = (text.match(/\r/g) ?? []).length - crlf;
  const lf = (text.match(/\n/g) ?? []).length - crlf;
  return { crlf, lf, cr };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const maxFindings = Number(options.maxFindings);
  if (!Number.isInteger(maxFindings) || maxFindings < 10 || maxFindings > 5000) {
    throw new ToolError('Maximum findings must be a whole number from 10 to 5000.');
  }

  const text = input.text;
  const endings = lineEndings(text);
  const rows: string[][] = [];
  let line = 1;
  let column = 1;
  let nonAsciiCount = 0;
  let findingCount = 0;
  let truncated = false;
  const controlCounts = new Map<string, number>();

  for (let index = 0; index < text.length;) {
    const point = text.codePointAt(index)!;
    const character = String.fromCodePoint(point);
    const width = character.length;
    const category = /\p{Cc}/u.test(character)
      ? 'Control'
      : /\p{Cf}/u.test(character)
        ? 'Format / invisible'
        : /\p{Zs}/u.test(character) && point !== 0x20
          ? 'Unusual space'
          : /\p{Mn}/u.test(character)
            ? 'Combining mark'
            : '';
    if (point > 0x7f) nonAsciiCount++;

    const isBomAtStart = point === 0xfeff && index === 0;
    const name = CODE_POINT_NAMES[point] ?? category;
    if (category && !(point === 0x0a || point === 0x0d || point === 0x09)) {
      controlCounts.set(name || category, (controlCounts.get(name || category) ?? 0) + 1);
    }
    const report = category && !(point === 0x0a || point === 0x0d || point === 0x09);
    if ((report || (options.showAllNonAscii && point > 0x7f)) && !isBomAtStart) {
      findingCount++;
      if (rows.length < maxFindings) {
        rows.push([
          String(line),
          String(column),
          `U+${hex(point, point > 0xffff ? 6 : 4)}`,
          category || 'Non-ASCII',
          name || character,
          character === ' ' ? '(space)' : JSON.stringify(character),
        ]);
      } else {
        truncated = true;
      }
    }

    if (point === 0x0d) {
      if (text.charCodeAt(index + 1) === 0x0a) {
        index += 2;
      } else {
        index += width;
      }
      line++;
      column = 1;
      continue;
    }
    if (point === 0x0a) {
      index += width;
      line++;
      column = 1;
      continue;
    }
    index += width;
    column++;
  }

  const bomName = text.startsWith('\ufeff') ? 'UTF-8 / Unicode BOM character present' : 'No leading BOM character';
  const newlineKinds = Object.entries(endings).filter(([, count]) => count > 0).map(([kind]) => kind.toUpperCase());
  const summaryRows = [
    ['Code points', String([...text].length)],
    ['Non-ASCII code points', String(nonAsciiCount)],
    ['Leading BOM', bomName],
    ['CRLF line endings', String(endings.crlf)],
    ['LF line endings', String(endings.lf)],
    ['CR line endings', String(endings.cr)],
    ['Line-ending style', newlineKinds.length > 1 ? `Mixed (${newlineKinds.join(', ')})` : newlineKinds[0] ?? 'None'],
    ['Reported character findings', String(findingCount)],
    ['Finding limit reached', truncated ? 'yes' : 'no'],
  ];
  const output = JSON.stringify({
    headers: ['Line', 'Column', 'Code point', 'Category', 'Name / description', 'Character'],
    rows,
  });

  return {
    output,
    render: 'table',
    stats: Object.fromEntries(summaryRows),
    notes: [
      text.startsWith('\ufeff')
        ? 'The BOM is reported in the summary and intentionally omitted from the character findings table.'
        : 'Original encoding cannot be inferred from an already-decoded pasted string.',
      ...(truncated ? [`Showing the first ${maxFindings} findings; ${findingCount - maxFindings} more were omitted.`] : []),
      ...(controlCounts.size ? [`Character counts: ${[...controlCounts].map(([name, count]) => `${name}: ${count}`).join(', ')}`] : []),
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
