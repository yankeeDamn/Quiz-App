/* Local UI regression only. All auth/API requests use synthetic fixtures.
 * Never run against a deployed origin. Runtime application auth is unchanged.
 * PLAYWRIGHT_MODULE and AXE_MODULE may point to tools installed outside this repo.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
let server;
process.on('exit', () => server?.kill());
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.THEME_TEST_ORIGIN || 'http://127.0.0.1:3100';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw Error('Use a local test server only.');
const output = path.resolve(process.env.THEME_TEST_OUTPUT || 'test-results/phase1-theme');
fs.mkdirSync(output, { recursive: true });
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
(async () => {
  if (process.env.THEME_TEST_START !== '0') {
    server = spawn(process.execPath, [require.resolve('../exam-practice-pro/node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', new URL(origin).port || '3100'], {
      cwd: path.resolve('exam-practice-pro'),
      env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001', NEXT_PUBLIC_APP_ENV: 'local', NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', fs.openSync(path.join(output, 'server.log'), 'w'), fs.openSync(path.join(output, 'server-errors.log'), 'w')],
    });
    let ready = false;
    for (let i = 0; i < 90; i++) {
      try { await fetch(origin + '/admin/design-system'); ready = true; break; } catch {}
      if (server.exitCode !== null) throw Error('Local preview server exited before becoming ready.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw Error('Local preview server did not become ready.');
  }
  const launch = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (process.env.CHROMIUM_MODULE) {
    const binary = require(process.env.CHROMIUM_MODULE);
    launch.executablePath = await binary.executablePath(); launch.args = binary.args;
  }
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
  let authenticated = true, allowed = true, identity = 'preview@example.test';
  const mutations = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: authenticated ? { user: { name: 'Preview admin', email: identity }, expires: '2099-01-01T00:00:00Z' } : null });
    if (url.pathname === '/api/auth/backend-token') return route.fulfill({ json: { token: 'synthetic-ui-test' } });
    if (url.pathname.startsWith('/api/v1/')) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.method() !== 'GET') mutations.push(url.pathname);
      let data = {};
      if (url.pathname.endsWith('/admin/me')) return route.fulfill({ status: allowed ? 200 : 403, headers, json: allowed ? { success: true, data: { via: 'account', email: 'preview@example.test' } } : { success: false, error: { message: 'This account is not an admin.' } } });
      if (url.pathname.endsWith('/command-center')) data = { questions: { total: 120, active: 110, topics: 8 }, publication: { published: 6, drafts: 2 }, catalogue: { total: 6, free: 4, pro: 2 }, attempts: { submitted: 400, accuracy: 72 }, plans: { active: 25, manualGrants: 0 }, checkedAt: '2026-11-28T00:00:00Z' };
      else if (url.pathname.endsWith('/admin/tests')) data = { tests: [] };
      else if (url.pathname.endsWith('/admin/topics')) data = { topics: [] };
      else if (url.pathname.includes('government-jobs')) data = { sources: [], jobs: [] };
      else if (url.pathname.endsWith('/mocks')) data = { tests: [] };
      else if (url.pathname.includes('bookmarks')) data = { bookmarks: [] };
      else if (url.pathname.includes('notes')) data = { notes: [] };
      else if (url.pathname.endsWith('/ebooks')) data = { ebooks: [] };
      else if (url.pathname.includes('capabilities')) data = { isOwnerAdmin: true };
      else if (url.pathname.endsWith('/practice/library')) data = { overrides: [], additions: [] };
      return route.fulfill({ headers, json: { success: true, data } });
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const results = [];
  async function audit(name) {
    await page.addScriptTag({ path: require.resolve(process.env.AXE_MODULE || 'axe-core/axe.min.js') });
    const result = await page.evaluate(async () => axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
    results.push({ name, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
  }
  try {
    await page.goto(origin + '/admin/design-system');
    await page.getByRole('heading', { name: 'Built for focused learning.' }).waitFor();
    assert(await page.locator('html').evaluate(el => el.classList.contains('dark')), 'new visitors default to dark even with a light OS');
    for (const theme of ['dark', 'light']) {
      await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true }).click();
      await audit('design-system-' + theme);
    }
    await page.reload();
    await page.getByRole('heading', { name: 'Built for focused learning.' }).waitFor();
    assert(await page.locator('html').evaluate(el => el.classList.contains('light')), 'theme choice persists');
    await page.getByRole('button', { name: 'System', exact: true }).click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.classList.contains('light'));
    await page.getByRole('button', { name: 'Remove sample', exact: true }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert(await page.getByText('Sample item: available', { exact: true }).isVisible());
    await page.getByRole('button', { name: 'Minutes', exact: false }).click();
    assert((await page.locator('tbody tr').first().innerText()).includes('Cloud fundamentals'));
    await page.getByRole('checkbox', { name: 'Select all visible rows' }).check();
    assert(await page.getByText('3 selected', { exact: true }).isVisible());
    await page.getByLabel('Search sample content').fill('security');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('checkbox', { name: 'Select all visible rows' }).uncheck();
    await page.getByLabel('Search sample content').fill('');
    assert(await page.getByText('2 selected', { exact: true }).isVisible());
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Search workspace pages' }).fill('no-such-command');
    assert(await page.getByText('No matching pages. Try another search.').isVisible());
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open dialog', exact: true }).click();
    await page.getByRole('heading', { name: 'Review your changes' }).waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Open dialog');
    await page.getByRole('button', { name: 'Open drawer', exact: true }).click();
    await page.getByRole('heading', { name: 'Sample publish panel' }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('input[type=file]').setInputFiles({ name: 'not-a-pdf.txt', mimeType: 'text/plain', buffer: Buffer.from('no') });
    assert(await page.getByRole('alert').filter({ hasText: 'Choose a non-empty PDF' }).isVisible());
    await page.locator('input[type=file]').setInputFiles({ name: 'preview.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nfixture') });
    assert(await page.getByText('1 PDF file(s) selected.', { exact: true }).isVisible());
    assert.equal(await page.locator('.ep-skeleton').first().evaluate(el => getComputedStyle(el).animationDuration), '1e-05s');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ['dark', 'light']) {
      await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true }).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no page overflow on mobile');
      await audit('design-system-mobile-' + theme);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => localStorage.setItem('theme', theme), theme);
      await page.goto(origin + '/admin');
      await page.getByRole('navigation', { name: 'Admin sections' }).waitFor();
      await audit('admin-' + theme);
      await page.goto(origin + '/');
      await page.locator('main').waitFor();
      await audit('student-home-' + theme);
    }
    if (process.env.THEME_TEST_BASELINE === '1') {
      const prefix = email => { let hash=0; for(const c of email){hash=((hash<<5)-hash)+c.charCodeAt(0);hash|=0;} return 'u_'+Math.abs(hash).toString(36)+'_'; };
      await page.evaluate(({prefix})=>{
        localStorage.setItem(prefix+'exam-practice-bookmarks',JSON.stringify([{questionId:'math-1',quizId:'math-fundamentals',createdAt:Date.now()}]));
      },{prefix:prefix(identity)});
      await page.goto(origin+'/bookmarks');
      await page.getByRole('heading',{name:'Bookmarked Questions'}).waitFor();
      await page.getByText('1 question saved for review').waitFor();
      identity='second@example.test';
      await page.reload();
      await page.getByText('0 questions saved for review').waitFor();
      identity='preview@example.test';
      await page.goto(origin+'/dashboard');
      await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
      await page.goto(origin+'/quiz/math-fundamentals/setup');
      await page.getByRole('button',{name:'Begin Test',exact:true}).click();
      await page.getByRole('timer').waitFor();
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      const paused=await page.getByRole('timer').innerText();
      await page.waitForTimeout(1500);
      assert.equal(await page.getByRole('timer').innerText(),paused,'paused timer stays fixed');
      await page.getByRole('button',{name:'Resume',exact:true}).click();
      await page.waitForFunction(old=>document.querySelector('[role=timer]')?.textContent?.trim()!==old,paused);
      await page.getByRole('button',{name:'Next',exact:true}).click();
      await page.getByText(/Question 2 of/,{exact:false}).first().waitFor();
      await page.goto(origin+'/quiz/math-fundamentals/flashcards');
      await page.getByRole('button',{name:'Show Answer',exact:true}).click();
      await page.getByRole('button',{name:'Got It',exact:true}).click();
      await page.getByText(/Card 2 of/).waitFor();
      await page.goto(origin+'/advertise');
      await page.getByRole('heading',{name:'Book a placement'}).waitFor();
      console.log('Browser-state, account separation, quiz timer, flashcard and draft-form regression checks passed.');
    }
    allowed = false;
    await page.goto(origin + '/admin/design-system');
    await page.getByRole('heading', { name: 'Workspace unavailable' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Built for focused learning.' }).count(), 0);
    authenticated = false;
    await page.reload();
    await page.getByRole('heading', { name: 'Owner administration' }).waitFor();
    assert.equal(mutations.length, 0, 'theme interactions must not mutate backend content');
    assert.deepEqual(errors, [], 'no browser exceptions');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks: 'passed', results, errors }, null, 2));
    console.log(JSON.stringify(results, null, 2));
    assert(results.every(result => result.violations.length === 0), 'fix axe violations in results.json');
    console.log('Theme, controls, responsive, permission and accessibility checks passed.');
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
    server?.kill();
  }
})().catch(error => { console.error(error); server?.kill(); process.exit(1); });
