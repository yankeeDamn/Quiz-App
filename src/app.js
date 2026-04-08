'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { generalLimiter } = require('./middleware/rate-limiter');
const paymentController = require('./controllers/payment.controller');

const app = express();

// ──────────────────────────────────────────────────────────
// 1. Security headers (OWASP A05:2021 – Security Misconfiguration)
// ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://js.stripe.com'],
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
        connectSrc: ["'self'", 'https://api.stripe.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for Stripe iframe
  })
);

// ──────────────────────────────────────────────────────────
// 2. CORS (OWASP A01:2021 – Broken Access Control)
// ──────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.env === 'production' ? config.cors.origins : true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Stripe-Signature'],
    credentials: true,
    maxAge: 86400,
  })
);

// ──────────────────────────────────────────────────────────
// 3. Stripe webhook — MUST be registered BEFORE json body parser
//    because Stripe needs the raw body for signature verification.
// ──────────────────────────────────────────────────────────
app.post(
  '/api/v1/payments/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

// ──────────────────────────────────────────────────────────
// 4. Body parsing
// ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ──────────────────────────────────────────────────────────
// 5. Request logging
// ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'incoming request');
  next();
});

// ──────────────────────────────────────────────────────────
// 6. Global rate limiter
// ──────────────────────────────────────────────────────────
app.use('/api/', generalLimiter);

// ──────────────────────────────────────────────────────────
// 7. Static files (serves Index.html, script.js, style.css)
// ──────────────────────────────────────────────────────────
app.use(express.static('public'));

// ──────────────────────────────────────────────────────────
// 8. API routes (versioned)
// ──────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ──────────────────────────────────────────────────────────
// 9. Convenience redirect: /health → /api/v1/health
// ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.redirect('/api/v1/health');
});

// ──────────────────────────────────────────────────────────
// 10. Error handling
// ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
