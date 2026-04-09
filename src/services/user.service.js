'use strict';

const db = require('../config/database');

/**
 * User service — profile and payment status queries.
 */
class UserService {
  async getById(userId) {
    const result = await db.query(
      `SELECT id, email, name, image, role, payment_status, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async getByEmail(email) {
    const result = await db.query(
      `SELECT id, email, name, image, role, payment_status, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  async updatePaymentStatus(userId, status) {
    await db.query(
      `UPDATE users SET payment_status = $1, role = CASE WHEN $1 = 'paid' THEN 'paid' ELSE role END, updated_at = NOW()
       WHERE id = $2`,
      [status, userId]
    );
  }

  async setStripeCustomerId(userId, customerId) {
    await db.query(
      `UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`,
      [customerId, userId]
    );
  }
}

module.exports = new UserService();
