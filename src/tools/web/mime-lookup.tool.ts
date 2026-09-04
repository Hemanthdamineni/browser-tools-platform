import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mime-lookup.meta';

/** ext → [mime, binary?] */
const MIME: Record<string, [string, boolean]> = {
  // images
  png: ['image/png', true],
  jpg: ['image/jpeg', true],
  jpeg: ['image/jpeg', true],
  gif: ['image/gif', true],
  webp: ['image/webp', true],
  avif: ['image/avif', true],
  svg: ['image/svg+xml', false],
  ico: ['image/x-icon', true],
  bmp: ['image/bmp', true],
  tif: ['image/tiff', true],
  tiff: ['image/tiff', true],
  heic: ['image/heic', true],
  heif: ['image/heif', true],
  jxl: ['image/jxl', true],
  psd: ['image/vnd.adobe.photoshop', true],
  ai: ['application/postscript', true],
  eps: ['application/postscript', true],
  // documents / office
  pdf: ['application/pdf', true],
  doc: ['application/msword', true],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', true],
  xls: ['application/vnd.ms-excel', true],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true],
  ppt: ['application/vnd.ms-powerpoint', true],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', true],
  odt: ['application/vnd.oasis.opendocument.text', true],
  ods: ['application/vnd.oasis.opendocument.spreadsheet', true],
  rtf: ['application/rtf', true],
  txt: ['text/plain', false],
  md: ['text/markdown', false],
  csv: ['text/csv', false],
  tsv: ['text/tab-separated-values', false],
  html: ['text/html', false],
  htm: ['text/html', false],
  css: ['text/css', false],
  xml: ['application/xml', false],
  json: ['application/json', false],
  jsonl: ['application/x-ndjson', false],
  yaml: ['text/yaml', false],
  yml: ['text/yaml', false],
  toml: ['text/plain', false],
  ini: ['text/plain', false],
  sql: ['application/sql', false],
  ics: ['text/calendar', false],
  vcf: ['text/vcard', false],
  // audio
  mp3: ['audio/mpeg', true],
  wav: ['audio/wav', true],
  ogg: ['audio/ogg', true],
  oga: ['audio/ogg', true],
  opus: ['audio/opus', true],
  flac: ['audio/flac', true],
  m4a: ['audio/mp4', true],
  aac: ['audio/aac', true],
  mid: ['audio/midi', true],
  midi: ['audio/midi', true],
  weba: ['audio/webm', true],
  aiff: ['audio/aiff', true],
  // video
  mp4: ['video/mp4', true],
  m4v: ['video/mp4', true],
  webm: ['video/webm', true],
  mov: ['video/quicktime', true],
  avi: ['video/x-msvideo', true],
  mkv: ['video/x-matroska', true],
  mpg: ['video/mpeg', true],
  mpeg: ['video/mpeg', true],
  wmv: ['video/x-ms-wmv', true],
  flv: ['video/x-flv', true],
  ogv: ['video/ogg', true],
  '3gp': ['video/3gpp', true],
  // archives
  zip: ['application/zip', true],
  gz: ['application/gzip', true],
  tgz: ['application/gzip', true],
  bz2: ['application/x-bzip2', true],
  xz: ['application/x-xz', true],
  '7z': ['application/x-7z-compressed', true],
  rar: ['application/vnd.rar', true],
  tar: ['application/x-tar', true],
  dmg: ['application/x-apple-diskimage', true],
  iso: ['application/x-iso9660-image', true],
  jar: ['application/java-archive', true],
  war: ['application/java-archive', true],
  wasm: ['application/wasm', true],
  // code
  js: ['text/javascript', false],
  mjs: ['text/javascript', false],
  cjs: ['text/javascript', false],
  ts: ['text/typescript', false],
  tsx: ['text/typescript', false],
  jsx: ['text/javascript', false],
  py: ['text/x-python', false],
  rb: ['text/x-ruby', false],
  go: ['text/x-go', false],
  rs: ['text/x-rust', false],
  java: ['text/x-java-source', false],
  c: ['text/x-c', false],
  h: ['text/x-c', false],
  cpp: ['text/x-c++', false],
  cs: ['text/x-csharp', false],
  sh: ['text/x-shellscript', false],
  bat: ['text/x-msdos-batch', false],
  php: ['application/x-httpd-php', false],
  pl: ['text/x-perl', false],
  lua: ['text/x-lua', false],
  // fonts
  ttf: ['font/ttf', true],
  otf: ['font/otf', true],
  woff: ['font/woff', true],
  woff2: ['font/woff2', true],
  eot: ['application/vnd.ms-fontobject', true],
  // data / other
  bin: ['application/octet-stream', true],
  exe: ['application/x-msdownload', true],
  msi: ['application/x-msi', true],
  apk: ['application/vnd.android.package-archive', true],
  swf: ['application/x-shockwave-flash', true],
  torrent: ['application/x-bittorrent', true],
};

const TEXTUAL = new Set(
  Object.entries(MIME)
    .filter(([, [, binary]]) => !binary)
    .map(([, [mime]]) => mime),
);

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const query = input.text.trim().toLowerCase().replace(/^\.+/, '');
  if (!query) return { output: '' };

  if (o.mode === 'ext-to-mime') {
    const ext = query.includes('.') ? query.split('.').pop()! : query;
    const entry = MIME[ext];
    if (!entry) {
      return {
        output: JSON.stringify({ headers: ['Extension', 'MIME type'], rows: [] }),
        render: 'table',
        notes: [`Unknown extension "${ext}" — try mime-to-ext mode or check the spelling.`],
      };
    }
    const [mime, binary] = entry;
    return {
      output: JSON.stringify({ headers: ['Extension', 'MIME type'], rows: [[ext, mime]] }),
      render: 'table',
      notes: [binary ? 'binary' : 'text'],
      stats: { extension: ext, kind: binary ? 'binary' : 'text' },
    };
  }

  // mime-to-ext
  const mime = query;
  const exts = Object.entries(MIME)
    .filter(([, [m]]) => m === mime)
    .map(([ext]) => ext);
  if (!exts.length) {
    return {
      output: JSON.stringify({ headers: ['MIME type', 'Extensions'], rows: [] }),
      render: 'table',
      notes: [`Unknown MIME type "${mime}".`],
    };
  }
  return {
    output: JSON.stringify({
      headers: ['MIME type', 'Extensions'],
      rows: [[mime, exts.join(', ')]],
    }),
    render: 'table',
    notes: [TEXTUAL.has(mime) ? 'text' : 'binary'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
