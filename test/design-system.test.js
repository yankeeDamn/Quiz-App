'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validatePdfSelection } = require('../exam-practice-pro/lib/file-selection');
const css = fs.readFileSync(path.join(__dirname, '../exam-practice-pro/app/globals.css'), 'utf8');
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
for (const [theme, selector] of [['dark', ':root, .dark'], ['light', '.light']]) {
  test(`${theme} brand, muted text and status tokens meet AA on their surfaces`, () => {
    const block = css.slice(css.indexOf(selector + ' {')).split('}')[0];
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(m => [m[1], m[2]]));
    for (const foreground of ['text', 'text-muted', 'accent-ink', 'success', 'warning', 'danger', 'info']) {
      for (const background of ['bg', 'surface-1', 'surface-2']) assert(contrast(tokens[foreground], tokens[background]) >= 4.5, `${foreground} on ${background}`);
    }
    assert(contrast(tokens['on-accent'], tokens.accent) >= 4.5);
    assert(contrast(tokens['on-accent'], tokens['accent-hover']) >= 4.5);
    assert(contrast(tokens['on-danger'], tokens.danger) >= 4.5);
    assert(contrast(tokens['control-border'], tokens['surface-2']) >= 3, 'control boundary');
  });
}
test('PDF selection rejects a mixed invalid batch without accepting partial input', () => {
  const good = { name: 'notes.PDF', type: 'application/pdf', size: 1024 };
  assert.equal(validatePdfSelection([good]), null);
  assert.equal(validatePdfSelection([{ ...good, type: '' }]), null, 'some browsers omit MIME');
  assert.equal(validatePdfSelection([{ ...good, size: 3 * 1024 * 1024 }]), null);
  for (const bad of [{ ...good, size: 0 }, { ...good, size: -1 }, { ...good, size: 3 * 1024 * 1024 + 1 }, { ...good, size: NaN }, { ...good, type: 'text/html' }, { ...good, name: 'notes.pdf.html' }]) assert.equal(typeof validatePdfSelection([good, bad]), 'string');
  assert.equal(typeof validatePdfSelection(Array(21).fill(good)), 'string');
  assert.equal(validatePdfSelection(Array(20).fill(good)), null);
  assert.equal(validatePdfSelection([]), null, 'cancelled file chooser is a no-op');
});
