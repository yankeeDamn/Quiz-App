'use strict';

const { Pool } = require('pg');
const logger = require('../utils/logger');

/**
 * PostgreSQL connection pool.
 *
 * Reads DATABASE_URL from env.  When it is missing (local dev without a DB),
 * all queries are no-ops so the app can still start for frontend-only work.
 */
let pool = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.warn('DATABASE_URL not set — database features disabled');
    return null;
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected PostgreSQL pool error');
  });

  return pool;
}

/**
 * Run a parameterised query.
 *
 * @param {string} text  SQL with $1, $2, … placeholders
 * @param {any[]}  params
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const p = getPool();
  if (!p) {
    throw Object.assign(new Error('Database not configured'), {
      statusCode: 503,
    });
  }
  const start = Date.now();
  const result = await p.query(text, params);
  const duration = Date.now() - start;
  logger.debug({ text: text.slice(0, 80), duration, rows: result.rowCount }, 'db query');
  return result;
}

/**
 * Acquire a client from the pool for transactions.
 */
async function getClient() {
  const p = getPool();
  if (!p) {
    throw Object.assign(new Error('Database not configured'), {
      statusCode: 503,
    });
  }
  return p.connect();
}

/**
 * Returns true when a pool exists and a simple SELECT 1 succeeds.
 */
async function isHealthy() {
  try {
    const p = getPool();
    if (!p) return false;
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully shut down the pool (for tests / graceful shutdown).
 */
async function end() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { query, getClient, getPool, isHealthy, end };
