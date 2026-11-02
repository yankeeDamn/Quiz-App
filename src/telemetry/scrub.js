'use strict';
function safeUrl(raw) {
  if (typeof raw !== 'string') return undefined;
  try {
    const url = new URL(raw, 'https://redacted.invalid');
    // Keep a route shape, never parameters, credentials, query strings or fragments.
    const path = url.pathname
      .split('/')
      .map((part) => {
        const known =
          /^(api|v1|health|ready|auth|signin|callback|google|github|pricing|contact|privacy|terms|refunds|status|certifications|learn|government-jobs|applications|india-mocks|exampro|dashboard|admin|tests|exam-attempts|start|submit|progress|ebooks|attempts|practice|quiz|take|review|result|_next|static|chunks)$/;
        return !part || known.test(part) || /^\[[a-z-]+\]$/i.test(part)
          ? part
          : '[parameter]';
      })
      .join('/');
    return path || '/';
  } catch {
    return undefined;
  }
}
function scrubFrames(stacktrace) {
  if (!stacktrace?.frames) return undefined;
  return {
    frames: stacktrace.frames.map((frame) => {
      const filename =
        typeof frame.filename === 'string'
          ? frame.filename.split(/[?#]/)[0].split(/[\\/]/).pop()
          : undefined;
      return {
        filename,
        function: frame.function,
        module: frame.module,
        lineno: frame.lineno,
        colno: frame.colno,
        in_app: frame.in_app,
      };
    }),
  };
}
function scrubSpan(span) {
  const clean = {};
  for (const key of [
    'trace_id',
    'span_id',
    'parent_span_id',
    'op',
    'start_timestamp',
    'timestamp',
    'status',
    'origin',
    'segment_id',
    'is_segment',
  ]) {
    if (span[key] !== undefined) clean[key] = span[key];
  }
  return { ...clean, description: span.op || 'operation', data: {} };
}
function scrubEvent(event) {
  // A conservative allow-list keeps SDK technical fields, not arbitrary app context.
  const clean = {};
  for (const key of [
    'event_id',
    'timestamp',
    'start_timestamp',
    'platform',
    'level',
    'release',
    'dist',
    'environment',
    'sdk',
    'modules',
    'type',
    'measurements',
  ]) {
    if (event[key] !== undefined) clean[key] = event[key];
  }
  if (
    ['custom', 'url', 'route', 'view', 'component', 'task'].includes(
      event.transaction_info?.source,
    )
  )
    clean.transaction_info = { source: event.transaction_info.source };
  if (event.request)
    clean.request = {
      method: event.request.method,
      url: safeUrl(event.request.url),
    };
  if (event.transaction)
    clean.transaction = safeUrl(event.transaction) || 'application';
  const trace = event.contexts?.trace;
  if (trace)
    clean.contexts = {
      trace: Object.fromEntries(
        ['trace_id', 'span_id', 'parent_span_id', 'op', 'status', 'origin']
          .filter((k) => trace[k] !== undefined)
          .map((k) => [k, trace[k]]),
      ),
    };
  if (event.exception?.values)
    clean.exception = {
      values: event.exception.values.map((value) => ({
        type:
          typeof value.type === 'string' && /^[a-zA-Z0-9_.]+$/.test(value.type)
            ? value.type
            : 'Error',
        value: 'Application error (details withheld)',
        stacktrace: scrubFrames(value.stacktrace),
        mechanism: value.mechanism
          ? { type: value.mechanism.type, handled: value.mechanism.handled }
          : undefined,
      })),
    };
  if (event.spans) clean.spans = event.spans.map(scrubSpan);
  // user, email, IP, headers, cookies, bodies, breadcrumbs, tags, extras, log messages
  // and arbitrary contexts are intentionally not copied. Apply to transactions too.
  return clean;
}
module.exports = { scrubEvent, scrubSpan, safeUrl };
