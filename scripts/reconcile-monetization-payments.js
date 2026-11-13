#!/usr/bin/env node
'use strict';
// Operator recovery for missed webhooks. No migrations, charges or new orders.
// Default is read-only. --apply fetches Cashfree and grants verified settlements.
const db = require('../src/config/database');
const pay = require('../src/services/monetization-payments.service');
async function run() {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== '--apply'))
    throw Error(
      'Usage: node scripts/reconcile-monetization-payments.js [--apply]',
    );
  const { mode } = pay.providerSettings();
  const rows = (
    await db.query(
      "SELECT id FROM monetization_orders WHERE mode=$1 AND status IN ('pending','failed','cancelled') AND created_at<now()-interval '1 minute' ORDER BY created_at LIMIT 100",
      [mode],
    )
  ).rows;
  console.log(
    JSON.stringify({
      mode,
      apply: args.includes('--apply'),
      orders: rows.length,
    }),
  );
  for (const row of rows) {
    if (!args.includes('--apply')) {
      console.log(
        JSON.stringify({ orderId: row.id, action: 'would-reconcile' }),
      );
      continue;
    }
    try {
      const result = await pay.reconcile(row.id);
      console.log(JSON.stringify({ orderId: row.id, status: result.status }));
    } catch (error) {
      console.error(
        JSON.stringify({
          orderId: row.id,
          error:
            'Reconciliation failed; inspect provider and order before retrying',
          statusCode: error.statusCode || 500,
        }),
      );
      process.exitCode = 1;
    }
  }
}
run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
