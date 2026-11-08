'use strict';

const { PDFDocument } = require('pdf-lib');
const path = require('node:path');
const { createCanvas, DOMMatrix, ImageData, Path2D } = require('@napi-rs/canvas');
// PDF.js uses these browser primitives in Node's rendering pipeline.
for (const [name, value] of Object.entries({DOMMatrix, ImageData, Path2D})) {
  if (!globalThis[name]) globalThis[name] = value;
}
let renderer;
let inFlight = 0;
class CanvasFactory {
  create(width,height) {const canvas=createCanvas(width,height);return {canvas,context:canvas.getContext('2d')};}
  reset(target,width,height) {target.canvas.width=width;target.canvas.height=height;}
  destroy(target) {target.canvas.width=0;target.canvas.height=0;target.canvas=null;target.context=null;}
}

/**
 * Rasterize only the preview pages, then build a fresh image-only PDF.
 * copyPages alone is insufficient: shared resources, hidden text, attachments
 * or cross-page references can carry paid content into a nominal two-page PDF.
 * Full PDFs retain selectable text; only the free preview is rasterized.
 */
async function createPdfPreview(bytes, pageLimit = 2) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 3*1024*1024 || !Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 50)
    throw new TypeError('Expected a PDF up to 3 MiB and a preview page count from 1 to 50');
  if (inFlight >= 2) throw Object.assign(new Error('PDF processing is busy. Retry shortly.'),{statusCode:503});
  inFlight++;
  let task;
  try {
    renderer ||= import('pdfjs-dist/legacy/build/pdf.mjs');
    const {getDocument,AnnotationMode}=await renderer;
    const assets=path.dirname(require.resolve('pdfjs-dist/package.json'));
    task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,
      standardFontDataUrl:path.join(assets,'standard_fonts')+path.sep,
      cMapUrl:path.join(assets,'cmaps')+path.sep,cMapPacked:true,
      wasmUrl:path.join(assets,'wasm')+path.sep,
      CanvasFactory,maxImageSize:16*1024*1024,stopAtErrors:true});
    const original=await task.promise;
    if (!original.numPages) throw new Error('PDF has no pages');
    const preview=await PDFDocument.create();
    for(let n=1;n<=Math.min(pageLimit,original.numPages);n++) {
      const page=await original.getPage(n);
      const dimensions=page.getViewport({scale:1});
      const scale=Math.min(2,1600/Math.max(dimensions.width,dimensions.height));
      const viewport=page.getViewport({scale});
      const canvas=createCanvas(Math.max(1,Math.ceil(viewport.width)),Math.max(1,Math.ceil(viewport.height)));
      await page.render({canvasContext:canvas.getContext('2d'),canvas,viewport,annotationMode:AnnotationMode.DISABLE}).promise;
      const png=await preview.embedPng(canvas.toBuffer('image/png'));
      preview.addPage([dimensions.width,dimensions.height]).drawImage(png,{x:0,y:0,width:dimensions.width,height:dimensions.height});
      canvas.width=0;canvas.height=0;page.cleanup();
    }
    return Buffer.from(await preview.save());
  } finally {try {await task?.destroy();} finally {inFlight--;}}
}
module.exports = { createPdfPreview };
