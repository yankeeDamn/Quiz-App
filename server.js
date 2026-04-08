// server.js
// ─────────────────────────────────────────────────────────
// DEPRECATED — this file is kept for reference only.
// The production server has been refactored into src/server.js.
//
// To start the application, run:
//   npm start          (uses src/server.js)
//   npm run dev         (uses src/server.js with --watch)
// ─────────────────────────────────────────────────────────
//
// WHAT WAS WRONG WITH THIS FILE:
//
// 1. HARDCODED SECRET KEY (OWASP A02:2021 – Cryptographic Failures)
//    const stripe = require('stripe')('your-secret-key-here');
//    → Secrets must come from environment variables, never source code.
//
// 2. DEPRECATED CHARGES API
//    stripe.charges.create({...}) is legacy.
//    → Replaced with the Payment Intents API for SCA compliance & better UX.
//
// 3. NO INPUT VALIDATION (OWASP A03:2021 – Injection)
//    The /charge endpoint blindly trusted client-sent token + amount.
//    → Server now enforces amount validation & uses express-validator.
//
// 4. NO ERROR DETAILS / LOGGING
//    res.json({success: false}) — no diagnostics for debugging.
//    → Centralised error handler + Pino structured logging.
//
// 5. NO SECURITY HEADERS (OWASP A05:2021)
//    No helmet, no CORS, no rate limiting.
//    → All added in src/app.js.
//
// 6. NO WEBHOOK VERIFICATION
//    Without webhooks, payment confirmation relies on client → trivially spoofable.
//    → Stripe webhook with signature verification added.
//
// 7. NO GRACEFUL SHUTDOWN
//    process.exit() on errors would drop in-flight requests.
//    → SIGTERM / SIGINT handlers added in src/server.js.
//
// See README.md for the full architecture overview.
// ─────────────────────────────────────────────────────────

// eslint-disable-next-line no-console
console.warn(
  '⚠️  server.js is deprecated. Use `npm start` to run src/server.js instead.'
);

require('./src/server');

