'use strict';
const EVENTS = Object.freeze([
  'sign_in',
  'mock_started',
  'mock_completed',
  'pricing_viewed',
  'pro_requested_whatsapp',
]);
const KEYS = new Set(['exam_slug', 'test_id', 'plan_name']);
function validateEvent(event, props = {}) {
  if (
    !EVENTS.includes(event) ||
    !props ||
    typeof props !== 'object' ||
    Array.isArray(props)
  )
    return null;
  const clean = {};
  try {
    const prototype = Object.getPrototypeOf(props);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(props);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (
        typeof key !== 'string' ||
        !KEYS.has(key) ||
        !('value' in descriptors[key])
      )
        return null;
      const value = descriptors[key].value;
      if (
        typeof value !== 'string' ||
        !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(value)
      )
        return null;
      if (key === 'plan_name' && !['free', 'pro', 'institute'].includes(value))
        return null;
      clean[key] = value;
    }
  } catch {
    return null;
  }
  return clean;
}
function createTracker(send, enabled) {
  return (event, props) => {
    const clean = validateEvent(event, props);
    if (!clean || !enabled()) return false;
    try {
      send(event, clean);
      return true;
    } catch {
      return false;
    }
  };
}
function analyticsUrl(raw, customEvent = false) {
  try {
    const url = new URL(raw);
    if (
      /^\/(auth|api|admin|institute-admin|dashboard|bookmarks)(\/|$)/.test(
        url.pathname,
      )
    ) {
      if (!customEvent) return null;
      return new URL('/[activity]', url.origin).toString();
    }
    // Never record query strings, fragments, account references or arbitrary bad-link text.
    const staticPages =
      /^\/(|pricing|contact|privacy|terms|refunds|status|certifications|government-jobs|india-mocks|institutes|exampro)$/;
    if (!staticPages.test(url.pathname)) {
      if (/^\/india-mocks\/[^/]+$/.test(url.pathname))
        url.pathname = '/india-mocks/[id]';
      else if (/^\/certifications\/learn\/[^/]+$/.test(url.pathname))
        url.pathname = '/certifications/learn/[slug]';
      else if (/^\/quiz\/[^/]+\/[^/]+$/.test(url.pathname))
        url.pathname = '/quiz/[id]/[step]';
      else url.pathname = '/[other]';
    }
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
module.exports = { EVENTS, validateEvent, createTracker, analyticsUrl };
