import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { slugify } from '@/lib/format';
import { meta } from './online-notepad.meta';

/** A note as the notepad panel keeps it. */
export interface Note {
  id: string;
  title: string;
  content: string;
  /** Epoch milliseconds of the last edit. */
  updatedAt: number;
  /** Epoch milliseconds of creation. */
  createdAt: number;
}

/** How an export file is written: the bytes, the name and the MIME type. */
export interface NoteExport {
  output: string;
  filename: string;
  type: string;
}

/** The plain-text MIME type. */
const TXT_TYPE = 'text/plain';
/** The Markdown MIME type. */
const MD_TYPE = 'text/markdown';

/**
 * Turn a note into an exportable file. `.txt` exports the raw content;
 * `.md` prepends a `# title` heading so the file reads as a document.
 * The file name is the slug of the title, falling back to `note`.
 */
export function buildExport(note: Note, format: string): NoteExport {
  const asMarkdown = format === 'md';
  const title = note.title.trim() || 'note';
  const filename = `${slugify(title) || 'note'}.${asMarkdown ? 'md' : 'txt'}`;
  const body = note.content ?? '';
  if (asMarkdown) {
    return {
      output: `# ${title}\n\n${body}`.trimEnd(),
      filename,
      type: MD_TYPE,
    };
  }
  return { output: body, filename, type: TXT_TYPE };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const format = o.format === 'md' ? 'md' : 'txt';
  const note: Note = {
    id: 'export',
    title: String(o.title ?? 'note'),
    content: input.text ?? '',
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
  const out = buildExport(note, format);
  return {
    output: out.output,
    filename: out.filename,
    render: 'code',
    language: format === 'md' ? 'markdown' : 'text',
    stats: { format, characters: input.text.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;