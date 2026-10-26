/**
 * Editorial content for the pdf-fill-form tool page.
 *
 * Kept out of ``pdf-fill-form.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What filling a form means here',
      body: 'Open a PDF that has an interactive AcroForm and the tool reads the fields it actually contains — text boxes, checkboxes, radio groups, dropdowns and multi-select lists — so you only ever see fields the document really has. Read-only fields and buttons are skipped because they are not meant to be filled. You type or pick a value for each, and the result is saved as a flattened PDF with the answers painted into the page content and the interactive field layer removed, so nothing is left for a reader to type into.',
    },
    {
      heading: 'The field-value contract',
      body: 'The panel collects one value per field and hands them to the worker as a JSON object mapping each field name to what the user chose: a string for text, radio and dropdown fields, a boolean for a checkbox, and an array for a multi-select list. Because that payload is what drives the run, the tool stays usable from a test or a plain workbench when you supply the same JSON yourself. Only the fields that exist in the form are offered, so there is no guessing at a field the document never defined.',
    },
    {
      heading: 'What flattening does and why it is offered',
      body: 'The filled answers are drawn onto the page graphics and the form-field widgets are removed, which turns an editable form into an ordinary static PDF. That is the natural output for a completed job application, a registration, or a contract you want to send for signature: the recipient sees the finished answers and cannot overwrite them, and the file stays small and universally readable. The flattened copy keeps every original page and object; only the interactive layer is gone.',
    },
    {
      heading: 'Where the filling happens',
      body: 'The PDF is read and filled entirely on your device — the form never leaves the tab — and the values you enter are not uploaded. The panel pre-fills with whatever you typed the previous time in the same tab, and the processed PDF is produced in a background worker, so even a large multi-page form is filled without blocking the interface. If a field cannot be filled it is because the document marks it read-only, and the tool does not fight that permission.',
    },
  ],
  faq: [
    {
      q: 'Which fields can I fill?',
      a: 'Text fields, checkboxes, radio groups and dropdowns (and multi-select lists). Read-only fields and buttons are skipped because they are not meant to be filled.',
    },
    {
      q: 'What does "flatten" mean?',
      a: 'The answers are painted into the page content and the form fields are removed, so the result is an ordinary PDF — nothing left to type into.',
    },
    {
      q: 'Is the form uploaded anywhere?',
      a: 'No. The form is read and filled on this device and the filled PDF is produced in a background worker, so your answers never leave the tab.',
    },
    {
      q: 'Why can I not fill a field?',
      a: 'The PDF may have no interactive fields at all, or the field may be marked read-only by the document. Only editable fields are offered.',
    },
  ],
} as const;
