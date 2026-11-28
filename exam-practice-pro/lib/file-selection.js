'use strict';
/** Client-side convenience only; existing server upload validation remains authoritative. */
function validatePdfSelection(files, maxBytes = 3 * 1024 * 1024) {
  if (!Array.isArray(files) || files.length > 20) return 'Choose up to 20 PDFs at a time.';
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return 'File selection is unavailable.';
  if (files.some(file => !file || typeof file.name !== 'string' || !file.name.toLowerCase().endsWith('.pdf') || (file.type !== '' && file.type !== 'application/pdf') || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > maxBytes)) {
    return `Choose a non-empty PDF no larger than ${maxBytes / 1024 / 1024} MiB. The selection was not accepted.`;
  }
  return null;
}
module.exports = { validatePdfSelection };
