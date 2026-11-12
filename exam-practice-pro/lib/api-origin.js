'use strict';
// Shared by browser, server proxies, status page and Next rewrites. Empty means
// unavailable; never substitute production when configuration is missing.
function resolveApiOrigin(value, nodeEnv = 'development', appEnv = '', hostname = '') {
  const configured = String(value || '').trim();
  if (!configured) return nodeEnv === 'production' ? '' : 'http://localhost:3001';
  try {
    const url = new URL(configured);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return '';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return '';
    if (nodeEnv === 'production' && local && appEnv !== 'local') return '';
    const staging = appEnv === 'staging' || hostname === 'exampro-staging-ui.vercel.app';
    if (staging && url.hostname !== 'exampro-staging-api.onrender.com') return '';
    return url.origin;
  } catch { return ''; }
}
module.exports = { resolveApiOrigin };
