import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';

export const meta: ToolMeta = {
  id: 'pdf-fill-form',
  name: 'Fill PDF Form',
  category: 'pdf',
  summary: 'Fill AcroForm fields in a PDF and optionally flatten them into the page content.',
  description:
    'Select or type values for form fields (text, checkboxes, radio, dropdown) and optionally flatten the result so the filled values appear permanently in the PDF.',
  keywords: ['pdf', 'form', 'fill', 'acroform', 'flatten'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'flatten',
      label: 'Flatten after filling',
      type: 'boolean',
      default: true,
    },
    {
      key: 'fieldValues',
      label: 'Field values (JSON)',
      type: 'text',
      default: '{}',
      help: 'Object with field names as keys and values to set (string, boolean, number, etc.). e.g. {"Name": "John Doe", "Age": 30}',
    },
  ],
  examples: [{ title: 'Fill and flatten' }],
  faq: [
    {
      q: 'What field types are supported?',
      a: 'Text, checkboxes, radio buttons, dropdowns, and signature fields. Other types are ignored.',
    },
  ],
  related: ['pdf-sign', 'pdf-metadata'],
  credits: [pdfCredit],
  status: 'beta',
};