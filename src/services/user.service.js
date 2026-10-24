'use strict';

const db = require('../config/database');
const { nextExpiry } = require('./plan.service');

const COLUMNS = 'id, email, name, image, role, payment_status, plan, plan_expires_at, created_at';

/**
 * User service: profile and plan queries.
 */
class UserService {
  async getById(userId) {
    const result = await db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [userId]);
    return result.rows[0] || null;
  }

  async getByEmail(email) {
    const result = await db.query(`SELECT ${COLUMNS} FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    return result.rows[0] || null;
  }

  /**
   * Give a user a paid plan. Renewals extend the current expiry.
   * Creates the user row when the person has not signed in yet.
   * Emails are matched without regard to upper or lower case.
   */
  async grantPlan({ email, plan, months, amountInr = null, note = null }) {
    const existing = await this.getByEmail(email);
    const expiresAt = nextExpiry(existing ? existing.plan_expires_at : null, months);

    let user;
    if (existing) {
      const result = await db.query(
        `UPDATE users
           SET plan = $2, plan_expires_at = $3, payment_status = 'paid', updated_at = NOW()
         WHERE id = $1
         RETURNING ${COLUMNS}`,
        [existing.id, plan, expiresAt]
      );
      user = result.rows[0];
    } else {
      const result = await db.query(
        `INSERT INTO users (email, plan, plan_expires_at, payment_status, role)
         VALUES (LOWER($1), $2, $3, 'paid', 'user')
         RETURNING ${COLUMNS}`,
        [email, plan, expiresAt]
      );
      user = result.rows[0];
    }

    await db.query(
      `INSERT INTO plan_grants (user_id, plan, months, amount_inr, note, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, plan, months, amountInr, note, expiresAt]
    );
    return user;
  }

  /** End a plan now. Returns null when the email is unknown. */
  async revokePlan(email) {
    const result = await db.query(
      `UPDATE users
         SET plan = 'free', plan_expires_at = NULL, payment_status = 'unpaid', updated_at = NOW()
       WHERE LOWER(email) = LOWER($1)
       RETURNING ${COLUMNS}`,
      [email]
    );
    return result.rows[0] || null;
  }
}

module.exports = new UserService();
