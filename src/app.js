'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { generalLimiter } = require('./middleware/rate-limiter');

const app = express();

// ──────────────────────────────────────────────────────────
// 1. Security headers (OWASP A05:2021 – Security Misconfiguration)
// ──────────────────────────────────────────────────────────
app.use(helmet());

// ──────────────────────────────────────────────────────────
// 2. CORS (OWASP A01:2021 – Broken Access Control)
// ──────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.cors.origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
);

// ──────────────────────────────────────────────────────────
// 3. Body parsing
// ──────────────────────────────────────────────────────────
// The admin page can import many questions at once, so it gets a larger limit.
app.use('/api/v1/admin', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ──────────────────────────────────────────────────────────
// 4. Request logging
// ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'incoming request');
  next();
});

// ──────────────────────────────────────────────────────────
// 5. Global rate limiter
// ──────────────────────────────────────────────────────────
app.use('/api/', generalLimiter);

// ──────────────────────────────────────────────────────────
// 6. API routes (versioned)
// ──────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ──────────────────────────────────────────────────────────
// 7. Convenience redirect: /health → /api/v1/health
// ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.redirect('/api/v1/health');
});

// ──────────────────────────────────────────────────────────
// 8. Error handling
// ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
