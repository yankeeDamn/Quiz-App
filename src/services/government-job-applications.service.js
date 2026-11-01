'use strict';

/** Private application tracker. Nothing here checks the government's application status. */
const crypto = require('node:crypto');
const db = require('../config/database');

const CATEGORIES = new Set(['SSC', 'UPSC', 'Railways', 'Banking', 'General', 'Other']);
const STATUSES = new Set(['planning', 'applied', 'admit_card', 'exam_completed', 'result_checked', 'withdrawn']);
const FIELDS = new Set(['noticeId', 'title', 'organisation', 'category', 'officialUrl', 'status', 'applicationDate', 'deadline', 'reference']);
const ID_RE = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const SAFE_REF_RE = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{1,78}[A-Za-z0-9]$/;
const RETURN_FIELDS = 'id, notice_id, title, organisation, category, official_url, status, application_date, deadline, reference_suffix, created_at, updated_at';
function failure(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}
function key() {
  const input = process.env.GOVT_APPLICATION_ENCRYPTION_KEY || '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(input)) throw failure('Private application tracking is not configured.', 503);
  const decoded = Buffer.from(input, 'base64');
  if (decoded.length !== 32) throw failure('Private application tracking is not configured.', 503);
  return decoded;
}
function encryptReference(reference, secret = key()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  const ciphertext = Buffer.concat([cipher.update(reference, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}
function decryptReference(envelope, secret = key()) {
  const bytes = Buffer.from(envelope, 'base64');
  if (bytes.length < 29) throw failure('Stored reference cannot be read.', 500);
  const decipher = crypto.createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}
function textValue(value, field, min, max, { required = false } = {}) {
  if ((value == null || value === '') && !required) return null;
  if (typeof value !== 'string') throw failure(field + ' must be text.');
  const s = value.trim();
  if (s.length < min || s.length > max || /[\x00-\x1f\x7f]/.test(s)) throw failure('Invalid ' + field + '.');
  return s;
}
function officialUrl(value) {
  if (value == null || value === '') return null;
  const s = textValue(value, 'officialUrl', 12, 1000);
  let url;
  try { url = new URL(s); } catch { throw failure('Official link must be a valid HTTPS recruitment URL.'); }
  const host = url.hostname.toLowerCase();
  const allowed = host === 'gov.in' || host.endsWith('.gov.in') ||
    host === 'nic.in' || host.endsWith('.nic.in') ||
    host === 'ibps.in' || host.endsWith('.ibps.in') ||
    host === 'rrbcdg.gov.in';
  if (url.protocol !== 'https:' || !allowed || url.port || url.username || url.password) {
    throw failure('Use a verified government/IBPS HTTPS portal URL, or leave the link blank.');
  }
  return url.toString();
}
function dateValue(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw failure('Invalid ' + field + '.');
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || year > 2100 || d.toISOString().slice(0, 10) !== value) throw failure('Invalid ' + field + '.');
  return value;
}
function validatePayload(value, patch = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure('A JSON application object is required.');
  if (Object.keys(value).some(field => !FIELDS.has(field))) throw failure('Unsupported application field.');
  if (patch && !Object.keys(value).length) throw failure('At least one field is required.');
  const result = {};
  for (const [field, v] of Object.entries(value)) {
    if (field === 'title') result.title = textValue(v, field, 3, 180, { required: true });
    else if (field === 'organisation') result.organisation = textValue(v, field, 2, 180, { required: true });
    else if (field === 'noticeId') result.noticeId = textValue(v, field, 1, 80);
    else if (field === 'officialUrl') result.officialUrl = officialUrl(v);
    else if (field === 'applicationDate' || field === 'deadline') result[field] = dateValue(v, field);
    else if (field === 'category') {
      if (!CATEGORIES.has(v)) throw failure('Invalid category.');
      result.category = v;
    } else if (field === 'status') {
      if (!STATUSES.has(v)) throw failure('Invalid manually recorded status.');
      result.status = v;
    } else if (field === 'reference') {
      if (v == null || v === '') result.reference = null;
      else {
        if (typeof v !== 'string' || v.length > 80 || !SAFE_REF_RE.test(v.trim())) throw failure('Invalid application reference.');
        result.reference = v.trim();
      }
    }
  }
  if (!patch) {
    if (!result.title || !result.organisation) throw failure('Job title and organisation are required.');
    result.category ||= 'General';
    result.status ||= 'planning';
  }
  return result;
}
function assertId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw failure('Application not found.', 404);
}
function output(row) {
  const rawDate = value => value == null ? null : (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));
  return {
    id: row.id, noticeId: row.notice_id, title: row.title, organisation: row.organisation,
    category: row.category, officialUrl: row.official_url, status: row.status,
    applicationDate: rawDate(row.application_date), deadline: rawDate(row.deadline),
    referenceMasked: row.reference_suffix ? '••••' + row.reference_suffix : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
    statusSource: 'self_reported',
  };
}
function assertUser(userId) {
  if (typeof userId !== 'string' || !ID_RE.test(userId)) throw failure('Verified sign-in required.', 403);
}
async function list(userId) {
  assertUser(userId);
  key(); // fail closed even for listing when the encryption key is unavailable
  const { rows } = await db.query(
    'SELECT ' + RETURN_FIELDS + ' FROM public.govt_job_applications WHERE user_id=$1 ORDER BY updated_at DESC, id DESC LIMIT 200',
    [userId]
  );
  return { applications: rows.map(output), statusSource: 'self_reported' };
}
const COLUMNS = {
  noticeId: 'notice_id', title: 'title', organisation: 'organisation', category: 'category',
  officialUrl: 'official_url', status: 'status', applicationDate: 'application_date', deadline: 'deadline',
};
async function create(userId, input) {
  assertUser(userId);
  const secret = key();
  const fields = validatePayload(input);
  const values = [userId];
  const cols = ['user_id'];
  for (const [field, column] of Object.entries(COLUMNS)) {
    if (field in fields) { cols.push(column); values.push(fields[field]); }
  }
  if (fields.reference) {
    cols.push('reference_ciphertext', 'reference_suffix');
    values.push(encryptReference(fields.reference, secret), fields.reference.slice(-4));
  }
  const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
  const { rows } = await db.query(
    'INSERT INTO public.govt_job_applications (' + cols.join(', ') + ') VALUES (' + placeholders + ') RETURNING ' + RETURN_FIELDS,
    values
  );
  return { application: output(rows[0]) };
}
async function update(userId, id, input) {
  assertUser(userId); assertId(id);
  const secret = key();
  const fields = validatePayload(input, true);
  const assignments = [], values = [id, userId];
  for (const [field, column] of Object.entries(COLUMNS)) {
    if (field in fields) {
      values.push(fields[field]);
      assignments.push(column + '=$' + values.length);
    }
  }
  if ('reference' in fields) {
    values.push(fields.reference ? encryptReference(fields.reference, secret) : null);
    assignments.push('reference_ciphertext=$' + values.length);
    values.push(fields.reference ? fields.reference.slice(-4) : null);
    assignments.push('reference_suffix=$' + values.length);
  }
  assignments.push('updated_at=NOW()');
  const { rows } = await db.query(
    'UPDATE public.govt_job_applications SET ' + assignments.join(', ') +
    ' WHERE id=$1 AND user_id=$2 RETURNING ' + RETURN_FIELDS,
    values
  );
  if (!rows.length) throw failure('Application not found.', 404);
  return { application: output(rows[0]) };
}
async function remove(userId, id) {
  assertUser(userId); assertId(id);
  key();
  const { rowCount } = await db.query(
    'DELETE FROM public.govt_job_applications WHERE id=$1 AND user_id=$2',
    [id, userId]
  );
  if (!rowCount) throw failure('Application not found.', 404);
  return { deleted: true };
}
async function reveal(userId, id) {
  assertUser(userId); assertId(id);
  const secret = key();
  const { rows } = await db.query(
    'SELECT reference_ciphertext FROM public.govt_job_applications WHERE id=$1 AND user_id=$2',
    [id, userId]
  );
  if (!rows.length) throw failure('Application not found.', 404);
  return { reference: rows[0].reference_ciphertext ? decryptReference(rows[0].reference_ciphertext, secret) : null };
}
module.exports = { CATEGORIES, STATUSES, validatePayload, encryptReference, decryptReference, output, list, create, update, remove, reveal };
