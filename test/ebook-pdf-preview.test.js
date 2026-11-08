'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, PDFName } = require('pdf-lib');
const { createPdfPreview } = require('../src/services/ebook-pdf-preview');

test('preview is a separate two-page document with no source annotations', async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 5; i++) doc.addPage();
  doc.getPage(0).drawText('Visible preview');
  doc.getPage(2).drawText('CONFIDENTIAL PAID PAGE');
  await doc.attach(Buffer.from('SECRET ATTACHMENT'), 'secret.txt');
  doc.getPage(0).node.set(PDFName.of('Annots'), doc.context.obj([]));
  const source = Buffer.from(await doc.save());
  const result = await createPdfPreview(source);
  const preview = await PDFDocument.load(result);
  assert.equal(preview.getPageCount(), 2);
  assert.equal(preview.getPage(0).node.Annots()?.size() || 0, 0);
  assert.equal(preview.catalog.has(PDFName.of('Names')), false);
  const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const rendered = await getDocument({data:new Uint8Array(result)}).promise;
  assert.equal((await (await rendered.getPage(1)).getTextContent()).items.length,0);
  await rendered.destroy();
  assert.equal((await PDFDocument.load(source)).getPageCount(), 5);
});

test('short PDFs are handled and invalid input fails closed', async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  const bytes = Buffer.from(await doc.save());
  assert.equal((await PDFDocument.load(await createPdfPreview(bytes))).getPageCount(), 1);
  await assert.rejects(createPdfPreview(bytes, 0));
  await assert.rejects(createPdfPreview(Buffer.from('not a PDF')));
});
