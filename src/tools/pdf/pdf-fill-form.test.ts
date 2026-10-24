import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { FileRunInput } from '@/lib/types';
import { ToolError } from '@/lib/types';
import tool from './pdf-fill-form.tool';

/* -------------------------------------------------------------------------- */
/*  Fixtures — real forms built with pdf-lib                                   */
/* -------------------------------------------------------------------------- */

/** A one-page PDF with a text field, a checkbox, a radio group and a dropdown. */
async function formBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  const form = doc.getForm();

  const name = form.createTextField('name');
  name.setText('prefilled');
  name.addToPage(page, { x: 20, y: 260, width: 200, height: 22 });

  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 20, y: 230, width: 15, height: 15 });

  const colour = form.createRadioGroup('colour');
  colour.addOptionToPage('Red', page, { x: 20, y: 200, width: 15, height: 15 });
  colour.addOptionToPage('Blue', page, { x: 20, y: 175, width: 15, height: 15 });

  const country = form.createDropdown('country');
  country.addOptions(['France', 'Germany', 'Spain']);
  country.addToPage(page, { x: 20, y: 145, width: 150, height: 22 });

  return doc.save();
}

function pdfFile(bytes: Uint8Array, name = 'application-form.pdf'): File {
  return new File([bytes.slice().buffer], name, { type: 'application/pdf' });
}

async function formFile(name = 'application-form.pdf'): Promise<File> {
  return pdfFile(await formBytes(), name);
}

/** The form fields of a produced blob, read back with pdf-lib. */
async function fieldsOf(blob: Blob) {
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  return doc.getForm().getFields();
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('pdf-fill-form run', () => {
  it('fills the given fields, flattens the form and returns a PDF', async () => {
    const result = await tool.run({
      files: [await formFile()],
      options: {
        values: JSON.stringify({
          name: 'Ada Lovelace',
          agree: true,
          colour: 'Blue',
          country: 'Germany',
        }),
        outputName: 'application-form-filled.pdf',
      },
    } as FileRunInput);

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('application-form-filled.pdf');
    expect(result.outputs[0]!.blob.type).toBe('application/pdf');
    // A flattened document has no interactive fields left.
    expect(await fieldsOf(result.outputs[0]!.blob)).toHaveLength(0);
    expect(result.stats).toMatchObject({ fields: 4, filled: 4 });
  });

  it('leaves fields without a value blank and notes the count', async () => {
    const result = await tool.run({
      files: [await formFile()],
      options: { values: JSON.stringify({ name: 'Only the name' }) },
    } as FileRunInput);
    expect(result.stats).toMatchObject({ fields: 4, filled: 1 });
    expect(result.notes?.[0]).toMatch(/3 of 4 fields were left blank/);
  });

  it('ignores values for fields that do not exist', async () => {
    const result = await tool.run({
      files: [await formFile()],
      options: { values: JSON.stringify({ ghost: 'nope', name: 'Ada' }) },
    } as FileRunInput);
    expect(result.stats).toMatchObject({ filled: 1 });
  });

  it('flattens even when no values are supplied', async () => {
    const result = await tool.run({
      files: [await formFile()],
      options: {},
    } as FileRunInput);
    expect(await fieldsOf(result.outputs[0]!.blob)).toHaveLength(0);
    expect(result.outputs[0]!.filename).toBe('filled.pdf');
  });

  it('uses the requested output file name', async () => {
    const named = await tool.run({
      files: [await formFile()],
      options: { outputName: 'my answers' },
    } as FileRunInput);
    expect(named.outputs[0]!.filename).toBe('my answers.pdf');

    const alreadyPdf = await tool.run({
      files: [await formFile()],
      options: { outputName: 'Report.PDF' },
    } as FileRunInput);
    expect(alreadyPdf.outputs[0]!.filename).toBe('Report.PDF');
  });

  it('rejects a PDF that has no editable fields', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const plain = pdfFile(await doc.save(), 'plain.pdf');
    await expect(tool.run({ files: [plain], options: {} } as FileRunInput)).rejects.toThrow(
      /no fillable form fields/,
    );
  });

  it('rejects a file that is not a readable PDF', async () => {
    const bad = new File([new TextEncoder().encode('not a pdf')], 'bad.pdf', {
      type: 'application/pdf',
    });
    await expect(tool.run({ files: [bad], options: {} } as FileRunInput)).rejects.toThrow(
      ToolError,
    );
  });

  it('rejects an empty file selection', async () => {
    await expect(tool.run({ files: [], options: {} } as FileRunInput)).rejects.toThrow(
      /Choose a PDF file/,
    );
  });

  it('rejects malformed field values', async () => {
    await expect(
      tool.run({ files: [await formFile()], options: { values: '{oops' } } as FileRunInput),
    ).rejects.toThrow(ToolError);
  });

  it('reports progress from 0 to 1', async () => {
    const onProgress = vi.fn();
    await tool.run({
      files: [await formFile()],
      options: { values: JSON.stringify({ name: 'Ada' }) },
      onProgress,
    } as FileRunInput);
    const fractions = onProgress.mock.calls.map((call) => call[0] as number);
    expect(fractions[0]).toBe(0);
    expect(Math.max(...fractions)).toBeLessThanOrEqual(1);
    expect(Math.min(...fractions)).toBeGreaterThanOrEqual(0);
  });
});
