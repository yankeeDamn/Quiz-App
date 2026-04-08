'use strict';

const pino = require('pino');
const config = require('../config');

/**
 * Application-wide logger (Pino).
 *
 * - In development: pretty-printed output via pino-pretty.
 * - In production : structured JSON for ingestion by log aggregators.
 */
const logger = pino({
  level: config.logLevel,
  ...(config.env !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

module.exports = logger;
