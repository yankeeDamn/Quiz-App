'use strict';
const { scrubEvent, scrubSpan } = require('./scrub');
let client;
function init() {
  if (!process.env.SENTRY_DSN || client) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      dataCollection: { userInfo: false, httpBodies: [] },
      beforeSend: scrubEvent,
      beforeSendTransaction: scrubEvent,
      beforeSendSpan: scrubSpan,
    });
    client = Sentry;
  } catch {
    console.warn('Error monitoring could not be initialized.');
  }
}
function captureException(error) {
  try {
    if (client) client.captureException(error);
  } catch {
    /* monitoring must not interrupt the API response */
  }
}
module.exports = { init, captureException };
