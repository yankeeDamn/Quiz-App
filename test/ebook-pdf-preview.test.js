'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, PDFName } = require('pdf-lib');
const { createPdfPreview } = require('../src/services/ebook-pdf-preview');

test('preview is a separate two-page document with no source annotations', async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 5; i++) doc.addPage([600 + i * 10, 800 + i * 10]);
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
  assert.deepEqual(preview.getPage(0).getSize(), {width:600,height:800});
  assert.deepEqual(preview.getPage(1).getSize(), {width:610,height:810});
  assert.notDeepEqual(preview.getPage(1).getSize(), {width:620,height:820});
  assert.equal((await PDFDocument.load(source)).getPageCount(), 5);
});

test('short PDFs are handled and invalid input fails closed', async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  const bytes = Buffer.from(await doc.save());
  assert.equal((await PDFDocument.load(await createPdfPreview(bytes))).getPageCount(), 1);
  await assert.rejects(createPdfPreview(bytes, 0));
  await assert.rejects(createPdfPreview(bytes, 21));
  await assert.rejects(createPdfPreview(Buffer.from('not a PDF')));
});
