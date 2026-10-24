'use strict';

/**
 * Plan rules. Prices are shown on the website; the server only needs to know
 * which plans exist and whether a user's plan is still running.
 *
 * Payments are confirmed on WhatsApp. After the money arrives the owner calls
 * POST /api/v1/admin/grant, which sets `plan` and `plan_expires_at` on the user.
 */
const PAID_PLANS = ['pro', 'institute'];

/** Months a grant may cover. */
const MAX_MONTHS = 36;

function isPaidPlan(plan) {
  return PAID_PLANS.includes(plan);
}

/**
 * A plan is active when it is a paid plan and has not expired.
 * @param {string|null|undefined} plan
 * @param {Date|string|null|undefined} expiresAt
 * @param {Date} [now]
 */
function isPlanActive(plan, expiresAt, now = new Date()) {
  if (!isPaidPlan(plan) || !expiresAt) return false;
  const end = new Date(expiresAt);
  return !Number.isNaN(end.getTime()) && end.getTime() > now.getTime();
}

/**
 * New expiry date. Extends from the current expiry when the plan is still
 * running, so a renewal never loses paid days.
 */
function nextExpiry(currentExpiresAt, months, now = new Date()) {
  const start =
    currentExpiresAt && new Date(currentExpiresAt).getTime() > now.getTime()
      ? new Date(currentExpiresAt)
      : new Date(now);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}

module.exports = { PAID_PLANS, MAX_MONTHS, isPaidPlan, isPlanActive, nextExpiry };
