'use strict';

const { PDFDocument, PDFName } = require('pdf-lib');

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_PREVIEW_PAGES = 20;

/**
 * Build a physically separate preview PDF. Only the requested page objects are
 * copied into a fresh document; catalog-level names/attachments, AcroForms,
 * open actions and page annotations are removed so later paid pages and active
 * document actions are never delivered to preview readers.
 */
async function createPdfPreview(bytes, pageLimit = 2) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 8 ||
    bytes.length > MAX_PDF_BYTES ||
    !Number.isInteger(pageLimit) ||
    pageLimit < 1 ||
    pageLimit > MAX_PREVIEW_PAGES
  ) {
    throw new TypeError(
      'Expected a PDF up to 3 MiB and a preview page count from 1 to 20',
    );
  }

  let source;
  try {
    source = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
  } catch {
    throw new TypeError('The PDF is invalid or encrypted.');
  }

  const pageCount = source.getPageCount();
  if (!pageCount) throw new TypeError('PDF has no pages.');

  const preview = await PDFDocument.create();
  const indexes = Array.from(
    { length: Math.min(pageLimit, pageCount) },
    (_, index) => index,
  );
  const pages = await preview.copyPages(source, indexes);
  for (const page of pages) {
    page.node.delete(PDFName.of('Annots'));
    preview.addPage(page);
  }

  for (const key of ['Names', 'OpenAction', 'AA', 'AcroForm', 'Outlines']) {
    preview.catalog.delete(PDFName.of(key));
  }
  preview.setTitle('ExamPro ebook preview');
  preview.setProducer('ExamPro');
  preview.setCreator('ExamPro');

  return Buffer.from(
    await preview.save({
      addDefaultPage: false,
      useObjectStreams: true,
      updateFieldAppearances: false,
    }),
  );
}

module.exports = { createPdfPreview, MAX_PDF_BYTES, MAX_PREVIEW_PAGES };
