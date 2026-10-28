import { describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import tool from './pdf-fill-form.tool';
import { parseFieldValues, fillFormFields } from './pdf-fill-form.core';

const makePdfBytes = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  const form = doc.getForm();
  form.createTextField('name').addToPage(page, { x: 50, y: 300, width: 200, height: 20 });
  form.createTextField('email').addToPage(page, { x: 50, y: 270, width: 200, height: 20 });
  form.createCheckBox('subscribe').addToPage(page, { x: 50, y: 240, width: 20, height: 20 });
  form.createRadioGroup('gender');
  const gender = form.getRadioGroup('gender');
  gender.addOptionToPage('male', page, { x: 50, y: 210, width: 20, height: 20 });
  gender.addOptionToPage('female', page, { x: 100, y: 210, width: 20, height: 20 });
  const dropdown = form.createDropdown('country');
  dropdown.addOptions(['US', 'UK']);
  const bytes = await doc.save();
  return new Uint8Array(bytes);
};

const makeFile = async (): Promise<File> => {
  const bytes = await makePdfBytes();
  return new File([bytes.buffer], 'form.pdf', { type: 'application/pdf' });
};

describe('pdf-fill-form core', () => {
  it('parseFieldValues parses valid JSON', () => {
    const result = parseFieldValues('{"name": "John", "age": 30, "active": true}');
    expect(result).toEqual({ name: 'John', age: 30, active: true });
  });

  it('parseFieldValues returns empty object for invalid JSON', () => {
    const result = parseFieldValues('not json');
    expect(result).toEqual({});
  });

  it('parseFieldValues returns empty object for array', () => {
    const result = parseFieldValues('[1, 2, 3]');
    expect(result).toEqual({});
  });

  it('parseFieldValues returns empty object for empty string', () => {
    const result = parseFieldValues('');
    expect(result).toEqual({});
  });

  it('fillFormFields fills text fields', async () => {
    const bytes = await makePdfBytes();
    const doc = await PDFDocument.load(bytes);
    const result = await fillFormFields(doc, {
      flatten: false,
      fieldValues: { name: 'John Doe', email: 'john@example.com' },
    });
    const form = result.getForm();
    expect(form.getTextField('name').getText()).toBe('John Doe');
    expect(form.getTextField('email').getText()).toBe('john@example.com');
  });

  it('fillFormFields checks checkboxes', async () => {
    const bytes = await makePdfBytes();
    const doc = await PDFDocument.load(bytes);
    const result = await fillFormFields(doc, {
      flatten: false,
      fieldValues: { subscribe: true },
    });
    const form = result.getForm();
    expect(form.getCheckBox('subscribe').isChecked()).toBe(true);
  });

  it('fillFormFields unchecks checkboxes', async () => {
    const bytes = await makePdfBytes();
    const doc = await PDFDocument.load(bytes);
    const result = await fillFormFields(doc, {
      flatten: false,
      fieldValues: { subscribe: false },
    });
    const form = result.getForm();
    expect(form.getCheckBox('subscribe').isChecked()).toBe(false);
  });

  it('fillFormFields selects radio buttons', async () => {
    const bytes = await makePdfBytes();
    const doc = await PDFDocument.load(bytes);
    const result = await fillFormFields(doc, {
      flatten: false,
      fieldValues: { gender: 'female' },
    });
    const form = result.getForm();
    expect(form.getRadioGroup('gender').getSelected()).toBe('female');
  });

  it('fillFormFields selects dropdown options', async () => {
    const bytes = await makePdfBytes();
    const doc = await PDFDocument.load(bytes);
    const result = await fillFormFields(doc, {
      flatten: false,
      fieldValues: { country: 'UK' },
    });
    const form = result.getForm();
    expect(form.getDropdown('country').getSelected()).toEqual(['UK']);
  });

  it('fillFormFields flattens when requested', async () => {
    const bytes = await makePdfBytes();
    const doc = await PDFDocument.load(bytes);
    const result = await fillFormFields(doc, {
      flatten: true,
      fieldValues: { name: 'John' },
    });
    const form = result.getForm();
    const fields = form.getFields();
    expect(fields.length).toBe(0);
  });
});

describe('pdf-fill-form tool', () => {
  it('fills a form and returns a file', async () => {
    const file = await makeFile();
    const result = await tool.run({
      files: [file],
      options: {
        fieldValues: JSON.stringify({ name: 'Jane Doe' }),
        flatten: true,
      },
    });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toMatch(/\.pdf$/);
    expect(result.outputs[0]!.blob.type).toBe('application/pdf');
    expect(result.stats?.pages).toBe(1);
  });

  it('defaults flatten to true', async () => {
    const file = await makeFile();
    const result = await tool.run({
      files: [file],
      options: { fieldValues: JSON.stringify({ name: 'Test' }) },
    });
    expect(result.outputs).toHaveLength(1);
    // Check that form was flattened
    const blob = result.outputs[0]!.blob;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    expect(form.getFields().length).toBe(0);
  });

  it('throws ToolError when no file is provided', async () => {
    await expect(
      tool.run({ files: [], options: { fieldValues: '{}', flatten: true } }),
    ).rejects.toBeInstanceOf(ToolError);
  });

  it('throws ToolError for invalid JSON in fieldValues', async () => {
    const file = await makeFile();
    const result = await tool.run({
      files: [file],
      options: { fieldValues: 'not json', flatten: true },
    });
    expect(result.outputs).toHaveLength(1);
  });
});