'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Deploy-time input only. Runtime delivery always reads the database.
// The directory must be an access-controlled checkout/artifact outside frontend assets.
function privateContent(file) {
  if (!process.env.PRIVATE_CONTENT_DIR) return null;
  const root = path.resolve(process.env.PRIVATE_CONTENT_DIR);
  const target = path.resolve(root, file);
  if (!target.startsWith(root + path.sep)) throw new Error('Invalid private content path');
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}
module.exports = { privateContent };
