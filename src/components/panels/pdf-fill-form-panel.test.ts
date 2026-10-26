import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ToolError } from '@/lib/types';
import {
  applyFieldValue,
  classifyField,
  describeFormFields,
  fillAndFlatten,
  filledFilename,
  hasEditableFields,
  mountPdfFillFormPanel,
  parseValues,
  type FormValues,
} from './pdf-fill-form-panel';
import { runToolById } from '@/lib/worker/client';

const runToolByIdMock = vi.mocked(runToolById);

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({
  runToolById: vi.fn(),
}));

/* -------------------------------------------------------------------------- */
/*  Fixtures — real forms built and read with pdf-lib, no form mocks           */
/* -------------------------------------------------------------------------- */

/** Build a one-page PDF containing every fillable field kind, and return it. */
async function buildFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 500]);
  const form = doc.getForm();

  const name = form.createTextField('name');
  name.setText('Jane Doe');
  name.addToPage(page, { x: 20, y: 460, width: 200, height: 22 });

  const notes = form.createTextField('notes');
  notes.enableMultiline();
  notes.addToPage(page, { x: 20, y: 420, width: 200, height: 50 });

  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 20, y: 400, width: 15, height: 15 });

  const colour = form.createRadioGroup('colour');
  colour.addOptionToPage('Red', page, { x: 20, y: 380, width: 15, height: 15 });
  colour.addOptionToPage('Blue', page, { x: 20, y: 360, width: 15, height: 15 });

  const country = form.createDropdown('country');
  country.addOptions(['France', 'Germany', 'Spain']);
  country.addToPage(page, { x: 20, y: 335, width: 150, height: 22 });

  const langs = form.createOptionList('langs');
  langs.addOptions(['EN', 'DE', 'FR']);
  langs.addToPage(page, { x: 20, y: 300, width: 90, height: 40 });

  // A button and a read-only field — neither is fillable and both must be skipped.
  form.createButton('submit').addToPage('Submit', page, { x: 20, y: 260, width: 80, height: 20 });
  const locked = form.createTextField('locked');
  locked.setText('fixed');
  locked.enableReadOnly();
  locked.addToPage(page, { x: 20, y: 220, width: 200, height: 22 });

  return doc.save();
}

/** Reload a saved document and hand back its form for reading values back. */
async function readForm(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getForm();
}

/** A PDF with no interactive fields. */
async function buildPlainPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  return doc.save();
}

function pdfFile(bytes: Uint8Array, name = 'application-form.pdf'): File {
  return new File([bytes.slice().buffer], name, { type: 'application/pdf' });
}

/* -------------------------------------------------------------------------- */
/*  Pure logic — field classification                                         */
/* -------------------------------------------------------------------------- */

describe('classifyField', () => {
  it('classifies each fillable kind', async () => {
    const form = await readForm(await buildFormPdf());
    const byName = new Map(form.getFields().map((field) => [field.getName(), field]));
    expect(classifyField(byName.get('name')!)).toBe('text');
    expect(classifyField(byName.get('notes')!)).toBe('text');
    expect(classifyField(byName.get('agree')!)).toBe('checkbox');
    expect(classifyField(byName.get('colour')!)).toBe('radio');
    expect(classifyField(byName.get('country')!)).toBe('dropdown');
    expect(classifyField(byName.get('langs')!)).toBe('list');
  });

  it('rejects buttons and read-only fields', async () => {
    const form = await readForm(await buildFormPdf());
    const byName = new Map(form.getFields().map((field) => [field.getName(), field]));
    expect(classifyField(byName.get('submit')!)).toBeNull();
    expect(classifyField(byName.get('locked')!)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  Pure logic — enumeration + no-editable-fields path                        */
/* -------------------------------------------------------------------------- */

describe('describeFormFields', () => {
  it('lists only the editable fields, with their options and flags', async () => {
    const form = await readForm(await buildFormPdf());
    const fields = describeFormFields(form);
    expect(fields.map((field) => field.name)).toEqual([
      'name',
      'notes',
      'agree',
      'colour',
      'country',
      'langs',
    ]);
    expect(fields.find((field) => field.name === 'notes')!.multiline).toBe(true);
    expect(fields.find((field) => field.name === 'colour')!.options).toEqual(['Red', 'Blue']);
    expect(fields.find((field) => field.name === 'country')!.options).toEqual([
      'France',
      'Germany',
      'Spain',
    ]);
    expect(fields.find((field) => field.name === 'langs')!.options).toEqual(['EN', 'DE', 'FR']);
  });

  it('reports when a form has no editable fields', async () => {
    const form = await readForm(await buildFormPdf());
    expect(hasEditableFields(form)).toBe(true);

    const plain = await readForm(await buildPlainPdf());
    expect(hasEditableFields(plain)).toBe(false);
    expect(describeFormFields(plain)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Pure logic — value mapping per kind, read back with real pdf-lib          */
/* -------------------------------------------------------------------------- */

describe('applyFieldValue', () => {
  it('sets text', async () => {
    const form = await readForm(await buildFormPdf());
    applyFieldValue(form, { name: 'name', kind: 'text', options: [] }, 'Ada Lovelace');
    expect(form.getTextField('name').getText()).toBe('Ada Lovelace');
  });

  it('toggles a checkbox from a boolean or a "true" string', async () => {
    const form = await readForm(await buildFormPdf());
    const field = { name: 'agree', kind: 'checkbox' as const, options: [] };
    applyFieldValue(form, field, true);
    expect(form.getCheckBox('agree').isChecked()).toBe(true);
    applyFieldValue(form, field, false);
    expect(form.getCheckBox('agree').isChecked()).toBe(false);
    applyFieldValue(form, field, 'true');
    expect(form.getCheckBox('agree').isChecked()).toBe(true);
  });

  it('selects a radio by option label, ignoring an unknown one', async () => {
    const form = await readForm(await buildFormPdf());
    const field = { name: 'colour', kind: 'radio' as const, options: ['Red', 'Blue'] };
    applyFieldValue(form, field, 'Blue');
    expect(form.getRadioGroup('colour').getSelected()).toBe('Blue');
    applyFieldValue(form, field, 'Purple');
    expect(form.getRadioGroup('colour').getSelected()).toBe('Blue');
  });

  it('selects a dropdown by option label, ignoring an unknown one', async () => {
    const form = await readForm(await buildFormPdf());
    const field = {
      name: 'country',
      kind: 'dropdown' as const,
      options: ['France', 'Germany', 'Spain'],
    };
    applyFieldValue(form, field, 'Germany');
    expect(form.getDropdown('country').getSelected()).toEqual(['Germany']);
    applyFieldValue(form, field, 'Italy');
    expect(form.getDropdown('country').getSelected()).toEqual(['Germany']);
  });

  it('selects several values on a multi-select list', async () => {
    const form = await readForm(await buildFormPdf());
    applyFieldValue(
      form,
      { name: 'langs', kind: 'list', options: ['EN', 'DE', 'FR'], multiselect: true },
      ['DE', 'FR'],
    );
    expect(form.getOptionList('langs').getSelected()).toEqual(['DE', 'FR']);
  });
});

/* -------------------------------------------------------------------------- */
/*  Pure logic — fill + flatten, end to end                                    */
/* -------------------------------------------------------------------------- */

describe('fillAndFlatten', () => {
  it('fills, flattens and returns a PDF with the fields removed', async () => {
    const values: FormValues = {
      name: 'Ada Lovelace',
      agree: true,
      colour: 'Red',
      country: 'Germany',
      langs: ['DE', 'FR'],
    };
    const { bytes, fields, filled } = await fillAndFlatten(await buildFormPdf(), values);
    expect(fields).toBe(6);
    expect(filled).toBe(5); // "notes" is left blank

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getForm().getFields()).toHaveLength(0);
    expect(reloaded.getPageCount()).toBe(1);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('leaves unset fields blank and still flattens', async () => {
    const { bytes, fields, filled } = await fillAndFlatten(await buildFormPdf(), {
      name: 'Only the name',
    });
    expect(fields).toBe(6);
    expect(filled).toBe(1);
    expect((await PDFDocument.load(bytes)).getForm().getFields()).toHaveLength(0);
  });

  it('rejects a form with no editable fields', async () => {
    await expect(fillAndFlatten(await buildPlainPdf(), {})).rejects.toThrow(
      'This PDF has no fillable form fields.',
    );
  });

  it('rejects a file that is not a readable PDF', async () => {
    await expect(fillAndFlatten(new Uint8Array([1, 2, 3]), {})).rejects.toThrow(
      'This file is not a valid, readable PDF.',
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Pure logic — option parsing + output naming                               */
/* -------------------------------------------------------------------------- */

describe('parseValues', () => {
  it('parses a JSON object, coercing scalar shapes', () => {
    expect(
      parseValues(JSON.stringify({ name: 'Ada', agree: true, langs: ['DE', 'FR'], blank: '' })),
    ).toEqual({ name: 'Ada', agree: true, langs: ['DE', 'FR'], blank: '' });
  });

  it('treats blank input as an empty map', () => {
    expect(parseValues('')).toEqual({});
    expect(parseValues(undefined)).toEqual({});
  });

  it('rejects JSON that is not an object', () => {
    expect(() => parseValues('"nope"')).toThrow(ToolError);
    expect(() => parseValues('not json')).toThrow(ToolError);
  });
});

describe('filledFilename', () => {
  it('adds -filled before the .pdf extension', () => {
    expect(filledFilename('form.pdf')).toBe('form-filled.pdf');
    expect(filledFilename('FORM.PDF')).toBe('FORM-filled.pdf');
    expect(filledFilename('noext')).toBe('noext-filled.pdf');
  });
});

/* -------------------------------------------------------------------------- */
/*  Panel mount                                                               */
/* -------------------------------------------------------------------------- */

/** The markup PdfFillFormPanel.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.pdfFillFormPanel = '';
  root.dataset.toolId = 'pdf-fill-form';
  root.innerHTML = `
    <div data-drop></div>
    <ul data-file-list></ul>
    <p data-field-status role="status" aria-live="polite"></p>
    <div data-fields></div>
    <button type="button" data-run disabled>Fill and flatten form</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg></p></div>
    <div data-error hidden></div>
    <div data-result-wrap hidden><ul data-outputs></ul><ul data-notes></ul></div>
  `;
  document.body.append(root);
  return root;
}

/** Hand a file to the panel the way the drop zone does. */
async function chooseFile(root: HTMLElement, file: File): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('mountPdfFillFormPanel', () => {
  beforeEach(() => {
    runToolByIdMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders one input per editable field and enables the run button', async () => {
    const root = fixture();
    mountPdfFillFormPanel(root);

    await chooseFile(root, pdfFile(await buildFormPdf()));
    await vi.waitFor(() => {
      expect(root.querySelectorAll('[data-fields] > div')).toHaveLength(6);
    });

    // Text, checkbox, two radios, two selects (dropdown + list).
    expect(root.querySelectorAll('[data-fields] input[type="text"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-fields] textarea')).toHaveLength(1);
    expect(root.querySelectorAll('[data-fields] input[type="checkbox"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-fields] input[type="radio"]')).toHaveLength(2);
    expect(root.querySelectorAll('[data-fields] select')).toHaveLength(2);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
    expect(root.querySelector('[data-field-status]')!.textContent).toContain('6 fields found');
  });

  it('reports a PDF with no fillable fields and keeps the run button disabled', async () => {
    const root = fixture();
    mountPdfFillFormPanel(root);

    await chooseFile(root, pdfFile(await buildPlainPdf(), 'plain.pdf'));
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
    });
    expect(root.querySelector<HTMLElement>('[data-error]')!.textContent).toContain(
      'no fillable form fields',
    );
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
  });

  it('sends the collected values to the worker and shows the saved PDF', async () => {
    runToolByIdMock.mockResolvedValue({
      outputs: [
        {
          filename: 'application-form-filled.pdf',
          blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
        },
      ],
    });
    const root = fixture();
    mountPdfFillFormPanel(root);

    await chooseFile(root, pdfFile(await buildFormPdf()));
    await vi.waitFor(() => {
      expect(root.querySelectorAll('[data-fields] > div')).toHaveLength(6);
    });

    // Fill: the text box, the checkbox, the second radio, the dropdown and the list.
    root.querySelector<HTMLInputElement>('[data-fields] input[type="text"]')!.value = 'Ada';
    root.querySelector<HTMLInputElement>('[data-fields] input[type="checkbox"]')!.checked = true;
    root.querySelectorAll<HTMLInputElement>('[data-fields] input[type="radio"]')[1]!.checked = true;
    root.querySelectorAll<HTMLSelectElement>('[data-fields] select')[0]!.value = 'Germany';

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    });

    const [toolId, rawPayload] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('pdf-fill-form');
    // The mock receives `unknown`; the panel controls this option shape.
    const payload = rawPayload as { options: { values: string; outputName: string } };
    expect(payload.options.outputName).toBe('application-form-filled.pdf');
    expect(JSON.parse(payload.options.values)).toMatchObject({
      name: 'Ada',
      agree: true,
      colour: 'Blue',
      country: 'Germany',
    });

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(false);
    });
    expect(root.querySelectorAll('[data-outputs] li')).toHaveLength(1);
  });
});
