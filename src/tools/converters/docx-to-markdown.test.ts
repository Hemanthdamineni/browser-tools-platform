import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import tool from './docx-to-markdown.tool';
import type { FileRunResult, OptionValues } from '@/lib/types';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Default Extension="png" ContentType="image/png"/>' +
  '</Types>';

const NUMBERING =
  `<w:numbering xmlns:w="${W}">` +
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1">' +
  '<w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>' +
  '<w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl>' +
  '</w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
  '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  '</w:numbering>';

function stylesXml(inner: string): string {
  return `<w:styles xmlns:w="${W}">${inner}</w:styles>`;
}

function relsXml(inner: string): string {
  return `<Relationships xmlns="${REL}">${inner}</Relationships>`;
}

interface Parts {
  body: string;
  styles?: string;
  numbering?: string;
  rels?: string;
  media?: Record<string, Uint8Array>;
}

function documentXml(body: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body>${body}</w:body></w:document>`
  );
}

function docxBytes(parts: Parts): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    'word/document.xml': strToU8(documentXml(parts.body)),
  };
  if (parts.styles) files['word/styles.xml'] = strToU8(parts.styles);
  if (parts.numbering) files['word/numbering.xml'] = strToU8(parts.numbering);
  if (parts.rels) files['word/_rels/document.xml.rels'] = strToU8(parts.rels);
  for (const [path, bytes] of Object.entries(parts.media ?? {})) files[`word/${path}`] = bytes;
  return zipSync(files);
}

function fileFrom(bytes: Uint8Array, name = 'input.docx'): File {
  return new File([bytes as unknown as BlobPart], name);
}

function p(content: string, pPr = ''): string {
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${content}</w:p>`;
}
function run(text: string, rPr = ''): string {
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

async function convert(
  body: string,
  options: OptionValues = {},
  parts: Omit<Parts, 'body'> = {},
): Promise<FileRunResult> {
  return tool.run({ files: [fileFrom(docxBytes({ body, ...parts }))], options });
}

async function md(
  body: string,
  options: OptionValues = {},
  parts: Omit<Parts, 'body'> = {},
): Promise<string> {
  return (await convert(body, options, parts)).report?.output ?? '';
}

describe('docx-to-markdown basics', () => {
  it('converts headings, bold and italic', async () => {
    const body =
      p(run('Title'), '<w:pStyle w:val="Heading1"/>') +
      p(run('Bold', '<w:b/>') + run(' plain ') + run('italic', '<w:i/>'));
    expect(await md(body)).toBe('# Title\n\n**Bold** plain *italic*');
  });

  it('reports a markdown code block for a single file', async () => {
    const result = await convert(p(run('Hello world')));
    expect(result.report?.render).toBe('code');
    expect(result.report?.language).toBe('markdown');
    expect(result.outputs[0]?.filename).toBe('input.md');
    expect(await result.outputs[0]?.blob.text()).toBe('Hello world\n');
  });

  it('names the output after the source file', async () => {
    const result = await tool.run({
      files: [fileFrom(docxBytes({ body: p(run('x')) }), 'Report.docx')],
      options: {},
    });
    expect(result.outputs[0]?.filename).toBe('Report.md');
  });

  it('decodes XML entities', async () => {
    expect(await md(p(run('AT&amp;T &#233; &#x2603;')))).toBe('AT&T é ☃');
  });

  it('renders tabs and hard line breaks', async () => {
    const body = p(`<w:r><w:t xml:space="preserve">a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r>`);
    expect(await md(body)).toBe('a\tb  \nc');
  });

  it('skips empty paragraphs', async () => {
    expect(await md(p('') + p(run('only')) + p(''))).toBe('only');
  });

  it('writes plain text when requested', async () => {
    const body =
      p(run('Title'), '<w:pStyle w:val="Heading1"/>') + p(run('Bold', '<w:b/>') + run(' text', '<w:i/>'));
    const out = await md(body, { output: 'text' });
    expect(out).toBe('Title\nBold text');
  });
});

describe('docx-to-markdown lists', () => {
  it('converts ordered and bullet lists and nesting', async () => {
    const body =
      p(run('First'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>') +
      p(run('Second'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>') +
      p(run('Bullet a'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>') +
      p(run('Nested'), '<w:numPr><w:ilvl w:val="1"/><w:numId w:val="2"/></w:numPr>');
    expect(await md(body, {}, { numbering: NUMBERING })).toBe(
      '1. First\n1. Second\n- Bullet a\n  - Nested',
    );
  });

  it('numbers ordered items sequentially in plain text', async () => {
    const body =
      p(run('a'), '<w:numPr><w:numId w:val="1"/></w:numPr>') +
      p(run('b'), '<w:numPr><w:numId w:val="1"/></w:numPr>');
    expect(await md(body, { output: 'text' }, { numbering: NUMBERING })).toBe('1. a\n2. b');
  });

  it('treats a numbered paragraph without numbering data as a bullet', async () => {
    const body = p(run('item'), '<w:numPr><w:numId w:val="9"/></w:numPr>');
    expect(await md(body)).toBe('- item');
  });

  it('reads numbering inherited from a paragraph style', async () => {
    const styles = stylesXml(
      '<w:style w:type="paragraph" w:styleId="ListStyle">' +
        '<w:name w:val="List Style"/>' +
        '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' +
        '</w:style>',
    );
    const body = p(run('styled'), '<w:pStyle w:val="ListStyle"/>');
    expect(await md(body, {}, { styles, numbering: NUMBERING })).toBe('1. styled');
  });
});

describe('docx-to-markdown tables', () => {
  it('converts a table to a GitHub pipe table', async () => {
    const cell = (text: string) => `<w:tc>${p(run(text))}</w:tc>`;
    const row = (a: string, b: string) => `<w:tr>${cell(a)}${cell(b)}</w:tr>`;
    const body = `<w:tbl>${row('Name', 'Age')}${row('Ada', '36')}</w:tbl>`;
    expect(await md(body)).toBe('| Name | Age |\n| --- | --- |\n| Ada | 36 |');
  });

  it('escapes pipes and joins multi-paragraph cells with <br>', async () => {
    const body =
      '<w:tbl><w:tr><w:tc>' +
      p(run('a|b')) +
      '</w:tc><w:tc>' +
      p(run('line1')) +
      p(run('line2')) +
      '</w:tc></w:tr></w:tbl>';
    expect(await md(body)).toBe('| a\\|b | line1<br>line2 |\n| --- | --- |');
  });

  it('omits tables and warns when disabled', async () => {
    const body = `<w:tbl><w:tr><w:tc>${p(run('cell'))}</w:tc></w:tr></w:tbl>`;
    const result = await convert(body, { tables: false });
    expect(result.report?.output).toBe('');
    expect(result.warnings?.join(' ')).toMatch(/tables were skipped/i);
  });
});

describe('docx-to-markdown links, styles and revisions', () => {
  it('resolves hyperlinks through the relationships part', async () => {
    const rels = relsXml(
      '<Relationship Id="rId4" Type="http://x/hyperlink" Target="https://example.com" TargetMode="External"/>',
    );
    const body = p(`<w:hyperlink r:id="rId4">${run('Example')}</w:hyperlink>`);
    expect(await md(body, {}, { rels })).toBe('[Example](https://example.com)');
  });

  it('drops deleted text but keeps inserted text', async () => {
    const body = p(
      `<w:del>${run('gone').replace(/w:t/g, 'w:delText')}</w:del>` +
        `<w:ins>${run('kept')}</w:ins>`,
    );
    expect(await md(body)).toBe('kept');
  });

  it('recognises heading and quote styles through styles.xml', async () => {
    const styles = stylesXml(
      '<w:style w:type="paragraph" w:styleId="MyHeading"><w:name w:val="My Heading"/>' +
        '<w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/></w:style>',
    );
    const body = p(run('Deep'), '<w:pStyle w:val="MyHeading"/>') + p(run('Quoted'), '<w:pStyle w:val="Quote"/>');
    expect(await md(body, {}, { styles })).toBe('## Deep\n\n> Quoted');
  });

  it('turns off heading conversion when requested', async () => {
    const body = p(run('Not a heading'), '<w:pStyle w:val="Heading1"/>');
    expect(await md(body, { headings: false })).toBe('Not a heading');
  });
});

describe('docx-to-markdown escaping', () => {
  it('escapes Markdown special characters by default', async () => {
    expect(await md(p(run('a*b_c[d]')))).toBe('a\\*b\\_c\\[d\\]');
  });

  it('can leave characters literal and notes it', async () => {
    const result = await convert(p(run('a*b')), { escape: false });
    expect(result.report?.output).toBe('a*b');
    expect(result.notes?.join(' ')).toMatch(/escaping is off/i);
  });

  it('guards paragraph text that looks like a block marker', async () => {
    expect(await md(p(run('# not heading')))).toBe('\\# not heading');
    expect(await md(p(run('- not a list')))).toBe('\\- not a list');
  });
});

describe('docx-to-markdown images', () => {
  const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  const drawing =
    '<w:drawing><wp:inline><wp:docPr id="1" name="Pic 1" descr="Logo"/>' +
    '<a:blip r:embed="rId5"/></wp:inline></w:drawing>';
  const rels = relsXml(
    '<Relationship Id="rId5" Type="http://x/image" Target="media/image1.png"/>',
  );
  const parts = { rels, media: { 'media/image1.png': imageBytes } };

  it('skips images by default and notes it', async () => {
    const result = await convert(p('<w:r><w:drawing/></w:r>'), {}, { rels, media: parts.media });
    expect(result.report?.output).toBe('');
    expect(result.notes?.join(' ')).toMatch(/skipped/i);
    expect(result.stats?.images).toBe(1);
  });

  it('embeds images as data URIs', async () => {
    const out = await md(p(`<w:r>${drawing}</w:r>`), { images: 'embed' }, parts);
    expect(out).toContain('![Logo](data:image/png;base64,');
  });

  it('extracts and links images', async () => {
    const result = await convert(p(`<w:r>${drawing}</w:r>`), { images: 'link' }, parts);
    expect(result.report?.output).toContain('![Logo](input.assets/image1.png)');
    const media = result.outputs.find((o) => o.filename === 'input.assets/image1.png');
    expect(media).toBeTruthy();
    expect(new Uint8Array(await media!.blob.arrayBuffer())).toEqual(imageBytes);
  });

  it('describes images in plain text', async () => {
    const out = await md(p(`<w:r>${drawing}</w:r>`), { output: 'text', images: 'embed' }, parts);
    expect(out).toBe('[Image: Logo]');
  });
});

describe('docx-to-markdown errors', () => {
  it('rejects files that are not a ZIP', async () => {
    await expect(
      tool.run({ files: [new File(['not a docx'], 'bad.docx')], options: {} }),
    ).rejects.toThrow(/look like a Word/i);
  });

  it('explains legacy .doc files', async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    await expect(tool.run({ files: [fileFrom(ole, 'old.doc')], options: {} })).rejects.toThrow(
      /legacy binary Word document/i,
    );
  });

  it('points out Excel and PowerPoint packages', async () => {
    const xlsx = zipSync({ '[Content_Types].xml': strToU8(CONTENT_TYPES), 'xl/workbook.xml': strToU8('<x/>') });
    await expect(tool.run({ files: [fileFrom(xlsx, 'book.xlsx')], options: {} })).rejects.toThrow(
      /Excel workbook/i,
    );

    const pptx = zipSync({ 'ppt/presentation.xml': strToU8('<x/>') });
    await expect(tool.run({ files: [fileFrom(pptx, 'deck.pptx')], options: {} })).rejects.toThrow(
      /PowerPoint presentation/i,
    );
  });

  it('reports an OpenDocument file', async () => {
    const odt = zipSync({ mimetype: strToU8('application/vnd.oasis.opendocument.text'), 'content.xml': strToU8('<x/>') });
    await expect(tool.run({ files: [fileFrom(odt, 'doc.odt')], options: {} })).rejects.toThrow(
      /OpenDocument/i,
    );
  });

  it('rejects a ZIP without a readable document part', async () => {
    const zip = zipSync({ '[Content_Types].xml': strToU8(CONTENT_TYPES) });
    await expect(tool.run({ files: [fileFrom(zip)], options: {} })).rejects.toThrow(
      /readable Word document part/i,
    );
  });

  it('requires at least one file', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose a Word/i);
  });

  it('aborts when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({
        files: [fileFrom(docxBytes({ body: p(run('x')) }))],
        options: {},
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('docx-to-markdown multiple files', () => {
  it('produces one output per file and a summary table', async () => {
    const result = await tool.run({
      files: [
        fileFrom(docxBytes({ body: p(run('Alpha')) }), 'alpha.docx'),
        fileFrom(docxBytes({ body: p(run('Beta')) }), 'beta.docx'),
      ],
      options: {},
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['alpha.md', 'beta.md']);
    expect(result.report?.render).toBe('table');
    const table = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(table.rows.map((r) => r[1])).toEqual(['alpha.md', 'beta.md']);
    expect(result.stats?.documents).toBe(2);
  });

  it('de-duplicates output names', async () => {
    const result = await tool.run({
      files: [
        fileFrom(docxBytes({ body: p(run('one')) }), 'same.docx'),
        fileFrom(docxBytes({ body: p(run('two')) }), 'same.docx'),
      ],
      options: {},
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['same.md', 'same-2.md']);
  });

  it('warns when a document has no text', async () => {
    const result = await convert('');
    expect(result.warnings?.join(' ')).toMatch(/no text/i);
  });
});
