/**
 * Pure AcroForm logic for `pdf-fill-form`.
 *
 * Design
 * ------
 * Input   one PDF file (`application/pdf`) that contains an interactive form.
 * Options `values` — a JSON object mapping each field *name* to the value the
 *           user chose: a string for text / radio / single-choice fields, a
 *           boolean for checkboxes, and an array of strings for multi-select
 *           dropdowns and lists. Only names that exist as editable fields in
 *           the document are applied; everything else is ignored.
 *         `outputName` — the download file name.
 * Output  the same PDF with the answers filled in and the form flattened, so
 *         the values are painted into the pages and the fields are gone.
 *
 * Everything here is deterministic, DOM-free and side-effect free (except
 * {@link fillAndFlatten}, which only touches the pdf-lib document it is
 * handed), so it can be unit-tested in Node without a browser. The panel
 * imports the field types and helpers from here to build its inputs, but never
 * pulls pdf-lib into the page beyond what it needs to read the form: the
 * flattening runs inside the worker that runs the tool.
 */
import type { PDFField, PDFForm } from 'pdf-lib';
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib';
import { ToolError } from '@/lib/types';

/** The fillable kinds of AcroForm field this tool understands. */
export type FieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'list';

/** A fillable field offered to the user: its name, kind and (for choices) options. */
export interface FillableField {
  /** The field name as it appears in the form (also how it is addressed). */
  name: string;
  /** How the value is entered: free text, a tick, a single choice or a list. */
  kind: FieldKind;
  /** The available choices for radio, dropdown and list fields. */
  options: string[];
  /** True for text fields that accept more than one line. */
  multiline?: boolean;
  /** True for dropdowns/lists that accept more than one choice. */
  multiselect?: boolean;
}

/** A value map keyed by field name, as JSON (string | boolean | string[]). */
export type FormValues = Record<string, string | boolean | string[]>;

export const NO_FIELDS_MESSAGE = 'This PDF has no fillable form fields.';
export const NO_FIELDS_HINT =
  'The document may be a plain page or its fields may all be read-only.';

/**
 * Classify a form field as one of the editable {@link FieldKind}s, or return
 * `null` for fields that cannot be filled (buttons, signatures, unknown types)
 * or that the document marks read-only.
 */
export function classifyField(field: PDFField): FieldKind | null {
  if (field.isReadOnly()) return null;
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'list';
  return null; // PDFButton, PDFSignature and anything unknown are not fillable.
}

function optionsOf(field: PDFField): string[] {
  if (
    field instanceof PDFRadioGroup ||
    field instanceof PDFDropdown ||
    field instanceof PDFOptionList
  ) {
    return field.getOptions();
  }
  return [];
}

/**
 * Enumerate the editable fields of a form, in the order the form lists them.
 * Read-only fields and buttons/signatures are skipped — they are not offered.
 */
export function describeFormFields(form: PDFForm): FillableField[] {
  const fields: FillableField[] = [];
  for (const field of form.getFields()) {
    const kind = classifyField(field);
    if (!kind) continue;
    const descriptor: FillableField = { name: field.getName(), kind, options: optionsOf(field) };
    if (kind === 'text' && field instanceof PDFTextField && field.isMultiline()) {
      descriptor.multiline = true;
    }
    if (kind === 'dropdown' && field instanceof PDFDropdown) {
      descriptor.multiselect = field.isMultiselect();
    }
    if (kind === 'list' && field instanceof PDFOptionList) {
      descriptor.multiselect = field.isMultiselect();
    }
    fields.push(descriptor);
  }
  return fields;
}

/** True when the form has at least one editable field to offer. */
export function hasEditableFields(form: PDFForm): boolean {
  return describeFormFields(form).length > 0;
}

/**
 * Apply a single value to one field using the field's kind. `value` is a plain
 * JSON value as the UI produces it: a string for text / radio / single-choice,
 * a boolean for checkboxes, and an array of strings for multi-select dropdowns
 * and lists. Choices that are not among the field's own options are dropped, so
 * a field is never handed a value that does not fit it.
 */
export function applyFieldValue(
  form: PDFForm,
  field: FillableField,
  value: string | boolean | string[],
): void {
  switch (field.kind) {
    case 'text': {
      form.getTextField(field.name).setText(String(value ?? ''));
      return;
    }
    case 'checkbox': {
      const box = form.getCheckBox(field.name);
      if (value === true || value === 'true') box.check();
      else box.uncheck();
      return;
    }
    case 'radio': {
      const group = form.getRadioGroup(field.name);
      const chosen = typeof value === 'string' ? value : '';
      if (chosen && group.getOptions().includes(chosen)) group.select(chosen);
      return;
    }
    case 'dropdown':
    case 'list': {
      // A dropdown and a list are both choice fields, but pdf-lib exposes them
      // through different accessors.
      const choice =
        field.kind === 'list'
          ? form.getOptionList(field.name)
          : form.getDropdown(field.name);
      const allowed = choice.getOptions();
      const selected = (
        Array.isArray(value)
          ? value
          : typeof value === 'string' && value !== ''
            ? [value]
            : []
      ).filter(
        (option): option is string => typeof option === 'string' && allowed.includes(option),
      );
      if (selected.length) choice.select(selected);
      return;
    }
  }
}

/**
 * Parse the `values` option (a JSON object as the panel sends it) into a
 * {@link FormValues} map. A blank value is treated as an empty map, and a
 * malformed one raises a friendly {@link ToolError}.
 */
export function parseValues(raw: unknown): FormValues {
  const text = String(raw ?? '').trim();
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ToolError(
      'The field values could not be read.',
      'They must be a JSON object of field names and values.',
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ToolError(
      'The field values could not be read.',
      'They must be a JSON object of field names and values.',
    );
  }
  const values: FormValues = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (Array.isArray(value)) values[name] = value.map(String);
    else if (typeof value === 'boolean') values[name] = value;
    else if (value === null || value === undefined) values[name] = '';
    else values[name] = String(value);
  }
  return values;
}

/** The result of {@link fillAndFlatten}: the finished PDF plus what was filled. */
export interface FillOutcome {
  /** The filled and flattened document bytes. */
  bytes: Uint8Array;
  /** How many editable fields the form has. */
  fields: number;
  /** How many fields actually received a value. */
  filled: number;
}

/**
 * Fill a PDF's form with the given values, update the field appearances so the
 * answers are visible, then flatten the form and return the finished document.
 *
 * Values for fields that do not exist (or are not editable) are ignored.
 * Throws a {@link ToolError} when the document has no editable fields at all,
 * or is not a readable PDF.
 */
export async function fillAndFlatten(bytes: Uint8Array, values: FormValues): Promise<FillOutcome> {
  if (!bytes.byteLength) throw new ToolError('This file is not a valid, readable PDF.');
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/password|encrypted/i.test(message))
      throw new ToolError('This PDF is password-protected — unlock it first.');
    throw new ToolError('This file is not a valid, readable PDF.');
  }

  const form = doc.getForm();
  const fields = describeFormFields(form);
  if (!fields.length) throw new ToolError(NO_FIELDS_MESSAGE, NO_FIELDS_HINT);

  let filled = 0;
  for (const field of fields) {
    const value = values[field.name];
    if (value === undefined) continue; // leave fields with no value as they are
    applyFieldValue(form, field, value);
    filled += 1;
  }

  // Paint the answers into the page appearances, then bake them in.
  form.updateFieldAppearances();
  form.flatten();
  return { bytes: await doc.save(), fields: fields.length, filled };
}

/** A safe output filename based on the input PDF's name. */
export function filledFilename(name: string): string {
  return `${name.replace(/\.pdf$/i, '')}-filled.pdf`;
}