#!/usr/bin/env node
/** Read-only production smoke test. Never writes questions, attempts or user data. */
const api = process.env.API_URL?.replace(/\/$/, '');
const frontend = process.env.FRONTEND_URL?.replace(/\/$/, '');
if (!api || !/^https?:\/\//.test(api)) {
  console.error('Set API_URL to your deployed API origin, e.g. https://your-api.onrender.com');
  process.exit(2);
}
let failures = 0;
async function check(name, url, validate) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' });
    const body = await res.text();
    const result = validate(res, body);
    console.log(`${result ? 'PASS' : 'FAIL'} ${name}: HTTP ${res.status}`);
    if (!result) failures++;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    failures++;
  }
}
await check('API database readiness', `${api}/api/v1/health/ready`, (r,b) => r.status === 200 && JSON.parse(b).data?.database === 'connected');
await check('Public mock catalogue', `${api}/api/v1/mocks`, (r,b) => r.status === 200 && Array.isArray(JSON.parse(b).data?.tests));
await check('Admin denies anonymous access', `${api}/api/v1/admin/me`, r => [401,403].includes(r.status));
if (frontend) {
  if (!/^https?:\/\//.test(frontend)) { console.error('FRONTEND_URL must be an http(s) URL'); process.exit(2); }
  for (const path of ['/','/india-mocks','/admin','/exampro']) {
    await check(`Frontend ${path}`, `${frontend}${path}`, r => r.status === 200);
  }
}
if (failures) {
  console.error(`${failures} smoke check(s) failed. Verify hosting, environment variables, migrations and logs.`);
  process.exit(1);
}
console.log('Read-only smoke checks passed. Sign-in, writes, and persisted attempts still require manual E2E validation.');
