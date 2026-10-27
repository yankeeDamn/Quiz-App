'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const picker = fs.readFileSync(path.join(root, 'exam-practice-pro/components/admin/csv-import.tsx'), 'utf8');
const page = fs.readFileSync(path.join(root, 'exam-practice-pro/components/admin/questions-tab.tsx'), 'utf8');

test('CSV picker exposes a native accessible file input instead of a hidden input', () => {
  assert.match(picker, /aria-label="Choose CSV file"/);
  assert.match(picker, /type="file" accept="\.csv,text\/csv"/);
  assert.doesNotMatch(picker, /className="sr-only" type="file"/);
});

test('CSV upload confirms selected file and supports reselecting the same file', () => {
  assert.match(picker, /setSelectedFile\(file\.name\)/);
  assert.match(picker, /Selected: \{selectedFile\}/);
  assert.match(picker, /e\.currentTarget\.value=''/);
  assert.match(picker, /file\.name\.toLowerCase\(\)\.endsWith\('\.csv'\)/);
});

test('changing admin topic clears upload/validation state by remounting the picker', () => {
  assert.match(page, /<CsvImport key=\{topic\} topic=\{topic\}/);
});

test('uploading still requires server preview approval before saving rows', () => {
  assert.match(picker, /setApproved\(result\.data\.valid\)/);
  assert.match(picker, /disabled=\{!approved\|\|busy\}/);
});
