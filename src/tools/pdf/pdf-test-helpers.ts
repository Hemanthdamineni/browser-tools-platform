import { PDFDocument } from 'pdf-lib';

export function loadPdfBlob(blob: Blob): Promise<PDFDocument> {
  return blob.arrayBuffer().then((buffer) => PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: false }));
}

export async function makePdf(pageCount = 2): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([200 + i * 10, 300]);
  const bytes = await doc.save();
  const copy = bytes.slice().buffer;
  return new File([copy], 'sample.pdf', { type: 'application/pdf' });
}

export function makeInvalidPdf(name = 'bad.pdf'): File {
  return new File(['not a pdf'], name, { type: 'application/pdf' });
}

export function pngFile(): File {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pV8AAAAASUVORK5CYII=';
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new File([bytes.buffer], 'pixel.png', { type: 'image/png' });
}

export function jpegFile(): File {
  const base64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUC/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=';
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new File([bytes.buffer], 'pixel.jpg', { type: 'image/jpeg' });
}
