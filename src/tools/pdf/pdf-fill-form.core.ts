import type { PDFDocument } from 'pdf-lib';
import type { PDFField, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib';

export interface FillFormOptions {
  flatten: boolean;
  fieldValues: Record<string, unknown>;
}

export function parseFieldValues(json: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

export async function fillFormFields(
  doc: PDFDocument,
  options: FillFormOptions,
): Promise<PDFDocument> {
  const form = doc.getForm();
  const fields = form.getFields();

  for (const field of fields) {
    const name = field.getName();
    if (name in options.fieldValues) {
      const value = options.fieldValues[name];
      try {
        setFieldValue(field, value);
      } catch (e) {
        // ignore unsupported field types or errors
      }
    }
  }

  if (options.flatten) {
    form.flatten();
  }

  return doc;
}

function setFieldValue(field: PDFField, value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
    return; // unsupported
  }

  const type = field.constructor.name;

  if (type === 'PDFTextField') {
    (field as PDFTextField).setText(String(value));
  } else if (type === 'PDFCheckBox') {
    const checkbox = field as PDFCheckBox;
    if (value === true || value === 'true' || value === 1 || value === '1' || value === 'on' || value === 'yes') {
      checkbox.check();
    } else {
      checkbox.uncheck();
    }
  } else if (type === 'PDFRadioGroup') {
    const radioGroup = field as PDFRadioGroup;
    radioGroup.select(String(value));
  } else if (type === 'PDFDropdown') {
    const dropdown = field as PDFDropdown;
    dropdown.select(String(value));
  } else if (type === 'PDFOptionList') {
    // pdf-lib doesn't export PDFOptionList type; use duck typing
    const optionList = field as { select?: (value: string) => void };
    optionList.select?.(String(value));
  }
}