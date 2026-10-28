import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'invoice-generator',
  name: 'Invoice Generator',
  category: 'generators',
  summary:
    'Create professional invoices with line items, subtotal, tax, total, logo, and company details. Save drafts locally.',
  description:
    'Build a beautiful invoice PDF from a form. Add line items with quantity and price, apply tax rate, upload a logo, and save drafts locally. Everything runs client-side with pdf-lib.',
  keywords: ['invoice', 'pdf', 'billing', 'tax invoice', 'generate invoice', 'pdf-lib'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'companyName',
      label: 'Company Name',
      type: 'text',
      default: 'Your Company Inc.',
    },
    {
      key: 'companyAddress',
      label: 'Company Address',
      type: 'text',
      default: '123 Business St, City, State 12345',
    },
    {
      key: 'companyEmail',
      label: 'Company Email',
      type: 'text',
      default: 'billing@company.com',
    },
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      type: 'text',
      default: 'INV-001',
    },
    {
      key: 'invoiceDate',
      label: 'Invoice Date',
      type: 'text',
      default: new Date().toISOString().split('T')[0],
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      type: 'text',
      default: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    {
      key: 'lineItems',
      label: 'Line Items (JSON)',
      type: 'textarea',
      default: JSON.stringify([
        { description: 'Product/Service 1', quantity: 1, price: 99.99 },
        { description: 'Product/Service 2', quantity: 2, price: 49.99 },
      ], null, 2),
      placeholder: '[\n  { "description": "Service", "quantity": 1, "price": 99.99 }\n]',
      help: 'Array of objects with description, quantity, and price.',
    },
    {
      key: 'taxRate',
      label: 'Tax Rate (%)',
      type: 'number',
      default: 0,
    },
    {
      key: 'logo',
      label: 'Logo (base64 or URL)',
      type: 'text',
      default: '',
    },
  ],
  examples: [
    {
      title: 'Basic Invoice',
      input: '',
    },
  ],
  faq: [
    {
      q: 'What formats does the logo support?',
      a: 'Logo can be a URL (public image) or base64 string. It will be scaled to fit nicely.',
    },
    {
      q: 'How are drafts saved?',
      a: 'Drafts are saved to localStorage under "invoice-drafts". They are loaded on page load.',
    },
  ],
  related: [  "license-generator",
  "barcode"],
  status: 'stable',
};
