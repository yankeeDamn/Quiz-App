'use strict';
// Real local API + PostgreSQL; only OAuth and Cashfree are synthetic.
// No live provider requests or production database URLs are permitted.
const assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs'),
  { spawn } = require('node:child_process'),
  crypto = require('node:crypto');
const fixture = require('../test/helpers/payment-fixture');
fixture.configure();
const db = require('../src/config/database'),
  jwt = require('jsonwebtoken');
const { chromium, webkit, devices } = require(
  process.env.PLAYWRIGHT_MODULE || 'playwright',
);
const root = path.resolve(__dirname, '..'),
  frontend = path.join(root, 'exam-practice-pro'),
  origin = 'http://127.0.0.1:3026';
const output =
  process.env.PAYMENT_UI_ARTIFACT_DIR ||
  path.join(root, 'test-results', 'cashfree-checkout');
fs.mkdirSync(output, { recursive: true });
let nextServer, apiServer, provider, browser, page;
const results = [];
async function fits(page, label) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    label + ' must fit viewport',
  );
}
async function navigate(page, url) {
  await page.waitForLoadState('networkidle');
  return page.goto(url);
}
async function run(name, type, device) {
  browser = await type.launch({
    headless: true,
    ...(type === chromium && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    ...(type === chromium ? { args: ['--disable-dev-shm-usage'] } : {}),
  });
  const context = await browser.newContext(device);
  let email = 'browser-' + crypto.randomUUID() + '@example.test',
    signedIn = true,
    denyConfig = false;
  const calls = [],
    errors = [];
  await context.route('**/*', async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      reply = (data) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(data),
        });
    // Unrelated menu prefetches are outside this payment story. WebKit can
    // report navigation-cancelled RSC prefetches as CORS errors under routing.
    if (
      req.headers()['next-router-prefetch'] === '1' &&
      !['/pricing', '/account/payments'].includes(u.pathname)
    ) {
      return route.fulfill({ status: 204, body: '' });
    }
    if (u.pathname === '/api/auth/session')
      return reply(
        signedIn
          ? {
              user: { id: email, name: 'Synthetic Learner', email },
              expires: '2099-01-01T00:00:00Z',
            }
          : {},
      );
    if (u.pathname === '/api/auth/backend-token')
      return reply({
        token: jwt.sign(
          { sub: email, email, provider: 'google', emailVerified: true },
          process.env.AUTH_SECRET,
          { expiresIn: '1h' },
        ),
      });
    if (u.href === 'https://sdk.cashfree.com/js/v3/cashfree.js')
      return route.fulfill({
        contentType: 'application/javascript',
        body: `window.Cashfree=({mode})=>({checkout:async ({paymentSessionId,redirectTarget})=>{window.__checkoutMode=mode;if(redirectTarget!=='_self')throw Error('Wrong target');location.assign('https://checkout.synthetic.test/?order='+paymentSessionId.slice(8));}});`,
      });
    if (u.hostname === 'checkout.synthetic.test')
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><title>Synthetic hosted checkout</title><h1>Cashfree test fixture</h1><a href="${origin}/account/payments?monetization_order=${encodeURIComponent(u.searchParams.get('order'))}">Return to ExamPro</a>`,
      });
    if (u.pathname.startsWith('/api/v1/')) {
      calls.push({
        path: u.pathname,
        method: req.method(),
        body: req.postData(),
      });
      if (denyConfig && u.pathname === '/api/v1/monetization/config')
        return reply({ success: true, data: { checkout: null } });
      if (u.pathname === '/api/v1/user/profile')
        return reply({
          success: true,
          data: {
            user: { plan: 'free', planActive: false, planExpiresAt: null },
            isGuest: false,
          },
        });
      return route.continue();
    }
    if (u.origin === origin) return route.continue();
    return route.abort();
  });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const codes = [
    ['SSC_PACK_49', 'SSC CGL mock pass', 49, 30],
    ['IT_EBOOK_PACK_99', 'IT ebook & assessment pass', 99, 60],
    ['PRO_MONTHLY', 'Pro monthly', 199, 30],
    ['PRO_ANNUAL', 'Pro annual', 999, 365],
  ];
  // Guest authentication gate, Free plan and institute enquiry remain accessible.
  signedIn = false;
  await navigate(page, origin + '/pricing');
  await page
    .getByRole('button', { name: 'Choose SSC CGL mock pass', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'Sign in before paying', exact: true })
    .waitFor();
  assert.equal(
    calls.some((c) => c.path.endsWith('/create-order')),
    false,
  );
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(
    await page.getByRole('link', { name: 'Start free', exact: true }).count(),
    1,
  );
  assert.match(
    await page
      .getByRole('link', { name: 'Discuss institute pilot', exact: true })
      .getAttribute('href'),
    /^https:\/\/wa.me\//,
  );
  // Explicit backend unavailability keeps production checkout disabled.
  signedIn = true;
  denyConfig = true;
  await page.waitForLoadState('networkidle');
  await page.reload();
  await page
    .getByRole('button', { name: 'Choose Pro annual', exact: true })
    .click();
  await page.getByText(/New purchases are temporarily unavailable/).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Pay ₹999 with Cashfree', exact: true })
      .count(),
    0,
  );
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  denyConfig = false;
  for (const [code, title, amount, days] of codes) {
    await navigate(page, origin + '/pricing');
    await page
      .getByRole('button', { name: 'Choose ' + title, exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText(days + ' days', { exact: true }).waitFor();
    await dialog.getByText('No · one-time payment', { exact: true }).waitFor();
    assert.equal(await dialog.getByLabel(/UTR/).count(), 0);
    assert.equal(await dialog.locator('a[href*="wa.me"]').count(), 0);
    await fits(page, name + ' dialog');
    await dialog
      .getByLabel('Indian mobile number', { exact: true })
      .fill('9986418638');
    await dialog
      .getByRole('button', {
        name: `Pay ₹${amount} with Cashfree`,
        exact: true,
      })
      .click();
    await page.waitForURL('https://checkout.synthetic.test/**');
    const id = new URL(page.url()).searchParams.get('order');
    assert.ok(provider.orders.has(id));
    const post = calls.filter((c) => c.path.endsWith('/create-order')).at(-1);
    assert.equal(JSON.parse(post.body).code, code);
    assert.equal(JSON.parse(post.body).checkoutKey.length, 36);
    assert.equal(provider.orders.get(id).order_amount, amount);
    if (code === 'SSC_PACK_49') {
      await page.getByRole('link', { name: 'Return to ExamPro' }).click();
      await page
        .getByText('Payment is pending verification.', { exact: false })
        .waitFor();
      assert.equal(
        await page
          .getByRole('heading', {
            name: 'Payment verified. Your access is active.',
            exact: true,
          })
          .count(),
        0,
      );
      await page.evaluate(() => {
        localStorage.setItem('plan', 'pro');
        localStorage.setItem('paymentStatus', 'paid');
      });
      await navigate(
        page,
        origin +
          '/account/payments?monetization_order=' +
          id +
          '&status=paid&success=true',
      );
      await page
        .getByText('Payment is pending verification.', { exact: false })
        .waitFor();
      provider.settle(id);
      await page
        .getByRole('button', { name: 'Recheck payment', exact: true })
        .click();
    } else {
      provider.settle(id);
      await page.getByRole('link', { name: 'Return to ExamPro' }).click();
    }
    await page
      .getByRole('heading', {
        name: 'Payment verified. Your access is active.',
        exact: true,
      })
      .waitFor();
    await page.getByText('Payment receipt', { exact: true }).first().waitFor();
    await fits(page, name + ' receipt');
    const grant = (
      await db.query(
        'SELECT expires_at FROM monetization_grants WHERE reference=$1',
        ['cashfree:' + id],
      )
    ).rows;
    assert.equal(grant.length, 1);
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page
      .getByRole('heading', {
        name: 'Payment verified. Your access is active.',
        exact: true,
      })
      .waitFor();
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int n FROM monetization_grants WHERE reference=$1',
          ['cashfree:' + id],
        )
      ).rows[0].n,
      1,
    );
    // Refresh/remount must retain the checkout key even after settlement.
    const beforeRetry = provider.orders.size;
    await navigate(page, origin + '/pricing');
    await page
      .getByRole('button', { name: 'Choose ' + title, exact: true })
      .click();
    await page
      .getByLabel('Indian mobile number', { exact: true })
      .fill('9986418638');
    await page
      .getByRole('button', {
        name: `Pay ₹${amount} with Cashfree`,
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Payment verified', exact: true })
      .waitFor();
    assert.equal(
      provider.orders.size,
      beforeRetry,
      'a refreshed paid retry cannot create a new chargeable order',
    );
    await page
      .getByRole('button', { name: 'Start a new purchase', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await navigate(page, origin + '/account/payments');
  await page
    .getByRole('heading', { name: 'Your orders', exact: true })
    .waitFor();
  await page.locator('details').first().click();
  await page
    .getByRole('heading', { name: 'Payment receipt', exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(output, name + '-receipt.png'),
    fullPage: true,
  });
  // Cross-account browser return must reveal no receipt or entitlement.
  const otherId = [...provider.orders.keys()].at(-1);
  email = 'browser-other-' + crypto.randomUUID() + '@example.test';
  await navigate(
    page,
    origin + '/account/payments?monetization_order=' + otherId,
  );
  await page.getByText('Unknown order', { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('heading', { name: 'Payment receipt', exact: true })
      .count(),
    0,
  );
  // A failed attempt is visible and resumes the same payable order.
  await navigate(page, origin + '/pricing');
  await page
    .getByRole('button', { name: 'Choose SSC CGL mock pass', exact: true })
    .click();
  await page
    .getByLabel('Indian mobile number', { exact: true })
    .fill('9986418638');
  await page
    .getByRole('button', { name: 'Pay ₹49 with Cashfree', exact: true })
    .click();
  await page.waitForURL('https://checkout.synthetic.test/**');
  const failedId = new URL(page.url()).searchParams.get('order');
  provider.settle(failedId, 'FAILED');
  await page.getByRole('link', { name: 'Return to ExamPro' }).click();
  await page.getByText(/latest payment attempt was failed/).waitFor();
  await navigate(page, origin + '/pricing');
  await page
    .getByRole('button', { name: 'Choose SSC CGL mock pass', exact: true })
    .click();
  await page
    .getByLabel('Indian mobile number', { exact: true })
    .fill('9986418638');
  await page
    .getByRole('button', { name: 'Pay ₹49 with Cashfree', exact: true })
    .click();
  await page.waitForURL('https://checkout.synthetic.test/**');
  assert.equal(new URL(page.url()).searchParams.get('order'), failedId);
  provider.settle(failedId, 'USER_DROPPED');
  await page.getByRole('link', { name: 'Return to ExamPro' }).click();
  await page.getByText(/latest payment attempt was cancelled/).waitFor();
  // Width sweep includes the requested 320px boundary and desktop.
  await navigate(page, origin + '/pricing');
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fits(page, name + ' pricing ' + width);
  }
  await page.screenshot({
    path: path.join(output, name + '-pricing-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.screenshot({
    path: path.join(output, name + '-pricing-320.png'),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  results.push({
    browser: name,
    passed: true,
    products: 4,
    viewports: [320, 375, 390, 768, 1440],
    checks: [
      'authentication',
      'backend availability',
      'exact purchase terms',
      'hosted checkout redirect',
      'pending',
      'verified receipts',
      'persistent history',
      'duplicate return',
      'forged browser state',
      'cross-account',
      'failed retry',
      'cancelled',
    ],
  });
  console.log(
    'PASS ' +
      name +
      ': four checkout/redirect/receipt flows, failure/retry/cancellation, ownership and responsive layouts',
  );
  await context.close();
  await browser.close();
  browser = null;
}
(async () => {
  try {
    await fixture.schema();
    provider = fixture.provider();
    apiServer = fixture.app().listen(3001, '127.0.0.1');
    await new Promise((r) => apiServer.once('listening', r));
    nextServer = spawn(
      process.execPath,
      [
        path.join(frontend, 'node_modules/next/dist/bin/next'),
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        '3026',
      ],
      {
        cwd: frontend,
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: [
          'ignore',
          fs.openSync(path.join(output, 'next-server.log'), 'w'),
          fs.openSync(path.join(output, 'next-error.log'), 'w'),
        ],
      },
    );
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin + '/pricing')).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, 'built frontend must start');
    await run('android-chrome', chromium, devices['Pixel 7']);
    await run('iphone-safari', webkit, devices['iPhone 13']);
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify(
        {
          kind: 'synthetic provider; real local API and PostgreSQL; mobile emulation',
          results,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (page)
      await page
        .screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
        .catch(() => {});
    throw error;
  } finally {
    await browser?.close();
    nextServer?.kill('SIGTERM');
    if (apiServer) {
      apiServer.closeAllConnections();
      await new Promise((r) => apiServer.close(r));
    }
    provider?.restore();
    await db.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
