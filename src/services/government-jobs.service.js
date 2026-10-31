'use strict';
/** A read-only index of pinned official sources. Never invent openings or dates. */
const crypto = require('node:crypto');
const EMPLOYMENT_URL = 'https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All';
const UPSC_URL = 'https://cms.upsc.gov.in/examination-calendar/';
const TTL_MS = 30 * 60 * 1000;
const MAX_STALE_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const MAX_BYTES = 1024 * 1024;
const SOURCES = Object.freeze([
  { id: 'employment-news', label: 'Employment News (Govt. of India)', url: EMPLOYMENT_URL, urls: [EMPLOYMENT_URL] },
  // The official calendar can return 503 while the official homepage still works.
  { id: 'upsc', label: 'UPSC Forthcoming Examinations', url: UPSC_URL, urls: [UPSC_URL, 'https://cms.upsc.gov.in/'] },
]);
const PORTALS = Object.freeze([
  { name: 'Employment News', category: 'General', url: EMPLOYMENT_URL, description: 'Government recruitment advertisements and closing dates' },
  { name: 'Staff Selection Commission', category: 'SSC', url: 'https://ssc.gov.in/', description: 'SSC CGL, CHSL, MTS, GD, JE notices and calendar' },
  { name: 'Union Public Service Commission', category: 'UPSC', url: UPSC_URL, description: 'UPSC forthcoming examinations and official annual calendar' },
  { name: 'National Career Service', category: 'General', url: 'https://ncs.gov.in/', description: 'Government and other job listings; filter by organisation type' },
  { name: 'Institute of Banking Personnel Selection', category: 'Banking', url: 'https://www.ibps.in/', description: 'Banking recruitment notifications and calendars' },
  { name: 'Railway Recruitment Boards', category: 'Railways', url: 'https://www.rrbcdg.gov.in/', description: 'Railway recruitment notices and centralized employment notifications' },
]);
function plain(html) {
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/\s+/g, ' ').trim().slice(0, 350);
}
function parseDate(value, us = false) {
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = +(us ? match[2] : match[1]), month = +(us ? match[1] : match[2]), year = +match[3];
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() + 1 !== month || utc.getUTCDate() !== day) return null;
  return utc.toISOString().slice(0, 10);
}
function indiaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type) => parts.find((value) => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function idOf(...data) { return crypto.createHash('sha256').update(data.join('|').toLowerCase()).digest('hex').slice(0, 18); }

function inspectEmployment(html, now = new Date()) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > MAX_BYTES) return { items: [], recognized: false };
  const today = indiaToday(now);
  const results = new Map();
  let validRows = 0;
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr\s*>/gi) || [];
  for (const row of rows.slice(0, 1500)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map((match) => plain(match[1]));
    if (cells.length < 5) continue;
    // The current source's issue-date values contradict its MM/DD column heading.
    // Only expose unambiguous issue dates; deadlines have an explicit DD/MM heading.
    const deadline = parseDate(cells[4]);
    const org = cells[1], position = cells[2], method = cells[3];
    if (!deadline || org.length < 3 || org.length > 180 || position.length < 3 || position.length > 250 || method.length > 120) continue;
    if (/^(all jobs|method of appointment|organisation|organization|issued date|post)$/i.test(org)) continue;
    validRows++;
    if (deadline < today) continue;
    const dates = [...new Set([parseDate(cells[0]), parseDate(cells[0], true)].filter(Boolean))];
    const issue = dates.length === 1 && dates[0] <= today && dates[0] <= deadline ? dates[0] : null;
    const id = idOf(org, position, deadline);
    results.set(id, {
      id, title: position, organisation: org, category: 'General', status: 'open',
      applicationDeadline: deadline, noticeDate: issue, method, source: 'Employment News',
      sourceUrl: EMPLOYMENT_URL, applicationUrl: null,
      notice: 'Listed by Employment News. Read the official advertisement and verify eligibility before applying.',
    });
  }
  // Expired, well-formed rows prove a successful check with zero open jobs.
  // A blocked page or a changed table is still a parser failure, never a healthy empty feed.
  const hasHeadings = /ISSUED\s+DATE/i.test(plain(html)) || /ISSUED\s+DATE/i.test(html);
  const hasDeadline = /LAST\s+DATE/i.test(html);
  return {
    items: [...results.values()].sort((a, b) => a.applicationDeadline.localeCompare(b.applicationDeadline)).slice(0, 150),
    recognized: validRows > 0 && hasHeadings && hasDeadline,
  };
}
function parseEmployment(html, now = new Date()) { return inspectEmployment(html, now).items; }
function inspectUpcomingUpsc(html, sourceUrl = UPSC_URL) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > MAX_BYTES) return { items: [], recognized: false };
  // Match the actual section heading, not the same label in a large navigation menu.
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)];
  const heading = headings.find((match) => /^Forthcoming Examinations$/i.test(plain(match[2])));
  if (!heading) return { items: [], recognized: false };
  const start = heading.index + heading[0].length;
  const level = Number(heading[1]);
  const end = headings.find((match) => match.index >= start && Number(match[1]) <= level);
  const section = html.slice(start, Math.min(end?.index ?? html.length, start + 48000));
  const list = new Map();
  for (const match of [...section.matchAll(/<h[3-6]\b[^>]*>([\s\S]*?)<\/h[3-6]\s*>/gi)].slice(0, 30)) {
    const title = plain(match[1]);
    if (title.length < 10 || title.length > 180 || !/(examination|ldce|nda|cds|cisf|civil service)/i.test(title)) continue;
    const id = idOf('upsc', title);
    list.set(id, {
      id, title, organisation: 'Union Public Service Commission', category: 'UPSC', status: 'upcoming',
      applicationDeadline: null, noticeDate: null, method: 'Examination', source: 'UPSC',
      sourceUrl, applicationUrl: null,
      notice: 'Listed as forthcoming. Notification and application dates are not confirmed here. Check UPSC before applying.',
    });
  }
  const items = [...list.values()].slice(0, 12);
  return { items, recognized: items.length > 0 };
}
function parseUpcomingUpsc(html) { return inspectUpcomingUpsc(html).items; }

function sourceError(code, message) { return Object.assign(new Error(message), { code }); }
async function fetchText(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const originalHost = new URL(url).hostname;
  const allowedHosts = originalHost === 'employmentnews.gov.in' ? ['employmentnews.gov.in', 'www.employmentnews.gov.in'] : [originalHost];
  try {
    let target = url;
    for (let hop = 0; hop < 4; hop++) {
      const parsed = new URL(target);
      // Check every redirect destination BEFORE contacting it.
      if (parsed.protocol !== 'https:' || !allowedHosts.includes(parsed.hostname) || parsed.port || parsed.username || parsed.password) {
        throw sourceError('redirect', 'The official source redirected outside its approved domain.');
      }
      const res = await fetchImpl(target, { signal: controller.signal, headers: { Accept: 'text/html', 'User-Agent': 'ExamProJobsIndexer/1.0 (+https://quiz-app-virid-zeta-41.vercel.app/government-jobs)' }, redirect: 'manual' });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        await res.body?.cancel();
        if (!location) throw sourceError('redirect', 'The official source returned an incomplete redirect.');
        target = new URL(location, target).href;
        continue;
      }
      if (!res.ok) { await res.body?.cancel(); throw sourceError('http', `The official website returned HTTP ${res.status}. Please check its portal directly.`); }
      if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) {
        await res.body?.cancel(); throw sourceError('size', 'The official page exceeded the index size limit.');
      }
      const reader = res.body?.getReader();
      if (!reader) throw sourceError('empty', 'The official source returned no page content.');
      const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_BYTES) { await reader.cancel(); throw sourceError('size', 'The official page exceeded the index size limit.'); }
        chunks.push(value);
      }
      return { html: Buffer.concat(chunks).toString('utf8'), url: target };
    }
    throw sourceError('redirect', 'The official source redirected too many times.');
  } catch (error) {
    if (controller.signal.aborted) throw sourceError('timeout', 'The official website did not respond within eight seconds.');
    throw error;
  } finally { clearTimeout(timeout); }
}

// Separate instances let tests exercise refresh, expiry and failure handling without live requests.
function createJobsService({ fetchImpl = globalThis.fetch, clock = Date.now } = {}) {
  const cache = new Map(), pending = new Map(), failures = new Map();
  async function refresh(source, now) {
    const previous = cache.get(source.id), time = clock();
    const failure = failures.get(source.id);
    const failedResult = (detail) => previous && time - previous.checkedAt < MAX_STALE_MS
      ? { ...previous, health: 'stale', lastAttemptAt: detail.at, message: `${detail.message} Showing the last successful check.` }
      : { items: [], checkedAt: null, health: 'unavailable', lastAttemptAt: detail.at, message: detail.message };
    if (previous && time - previous.checkedAt < TTL_MS) return previous;
    if (pending.has(source.id)) return pending.get(source.id);
    if (failure && time < failure.retryAt) return failedResult(failure);
    const task = (async () => {
      try {
        let parsed, lastError;
        for (const url of source.urls) {
          try {
            const page = await fetchText(url, fetchImpl);
            parsed = source.id === 'employment-news' ? inspectEmployment(page.html, now) : inspectUpcomingUpsc(page.html, page.url);
            if (!parsed.recognized) throw sourceError('parse', 'The official page could not be read reliably. Its format may have changed.');
            break;
          } catch (error) { lastError = error; parsed = null; }
        }
        if (!parsed) throw lastError;
        const checkedAt = clock();
        const result = { items: parsed.items, checkedAt, lastAttemptAt: checkedAt, health: 'ok', message: parsed.items.length ? 'Official source checked successfully.' : 'Official listing checked successfully. All listed application deadlines have passed; no open vacancies were found in this source.' };
        failures.delete(source.id); cache.set(source.id, result); return result;
      } catch (error) {
        const detail = { at: clock(), retryAt: clock() + RETRY_MS, message: error.code && ['http', 'timeout', 'parse', 'size', 'empty', 'redirect'].includes(error.code) ? error.message : 'Could not connect to the official website. Please use its portal directly.' };
        failures.set(source.id, detail); return failedResult(detail);
      } finally { pending.delete(source.id); }
    })();
    pending.set(source.id, task); return task;
  }
  async function list(now = new Date(clock())) {
    const results = await Promise.all(SOURCES.map((source) => refresh(source, now)));
    const today = indiaToday(now);
    const jobs = results.flatMap((result) => result.items)
      .filter((job) => job.status === 'upcoming' || (job.applicationDeadline && job.applicationDeadline >= today))
      .sort((a, b) => a.status === b.status ? (a.applicationDeadline || '9999').localeCompare(b.applicationDeadline || '9999') : a.status === 'open' ? -1 : 1);
    return { jobs, portals: PORTALS, sources: SOURCES.map((source, i) => ({
      id: source.id, name: source.label, url: source.url, status: results[i].health,
      checkedAt: results[i].checkedAt == null ? null : new Date(results[i].checkedAt).toISOString(),
      lastAttemptAt: new Date(results[i].lastAttemptAt).toISOString(), message: results[i].message,
    })), updatedAt: new Date(clock()).toISOString(), disclaimer: 'ExamPro is not a government recruitment authority. Some official sources may be delayed or temporarily unavailable. Verify the complete notice, eligibility, deadlines and application link at the issuing authority.' };
  }
  return { list };
}
const service = createJobsService();
module.exports = { parseDate, indiaToday, parseEmployment, parseUpcomingUpsc, plain, list: service.list, createJobsService, PORTALS, SOURCES };
