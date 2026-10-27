'use strict';
const config = require('../config');

// Fail closed. Enabling a feature flag alone is not sufficient; the Render
// service must explicitly be marked staging and permit only the exact staging
// frontend origin. Production credentials and public learner endpoints are
// never a valid way to enable this functionality.
const STAGING_ORIGIN = 'https://exampro-staging-ui.vercel.app';
const PRODUCTION_ORIGIN = 'https://quiz-app-virid-zeta-41.vercel.app';
function enabled() {
  const origins = config.cors.origins;
  return config.draftTesting.enabled === true &&
    config.draftTesting.environment === 'staging' &&
    Boolean(config.databaseUrl) &&
    Array.isArray(origins) &&
    origins.includes(STAGING_ORIGIN) &&
    !origins.includes(PRODUCTION_ORIGIN);
}
module.exports = { enabled };
