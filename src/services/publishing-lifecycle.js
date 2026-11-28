'use strict';
// Pure lifecycle policy. Adapters must enforce readiness and perform their
// native content mutation atomically before a published state is recorded.
const transitions = Object.freeze({
  draft: Object.freeze(['review', 'scheduled', 'published', 'archived']),
  review: Object.freeze(['draft', 'scheduled', 'published', 'archived']),
  scheduled: Object.freeze(['draft', 'review', 'scheduled', 'published', 'archived']),
  published: Object.freeze(['draft', 'archived']),
  archived: Object.freeze(['draft']),
});
function invalid(message) { throw Object.assign(new Error(message), { statusCode: 409 }); }
function transition({ current, target, publishAt, ready, now = Date.now() }) {
  if (!Object.hasOwn(transitions, current) || !transitions[current].includes(target)) invalid('Invalid content transition.');
  if (target === 'published' || target === 'scheduled') {
    if (ready !== true) invalid('Content readiness checks must pass.');
  }
  if (target === 'scheduled') {
    if (typeof publishAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(publishAt)) invalid('An explicit timezone is required.');
    const time = Date.parse(publishAt);
    if (!Number.isFinite(time) || time <= now) invalid('Schedule must be in the future.');
    return { status: target, publishAt: new Date(time).toISOString() };
  }
  if (publishAt != null) invalid('Only scheduled content accepts a publication time.');
  return { status: target, publishAt: null };
}
module.exports = { transition };
