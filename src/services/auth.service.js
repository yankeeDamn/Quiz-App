'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Authentication service.
 *
 * Short-term: demo/guest authentication with signed JWTs.
 * Long-term:  hook into a real user database (see models/user.model.js).
 */
class AuthService {
  /**
   * Register a new user (demo — stores nothing persistently).
   *
   * In a real implementation this would write to a database.
   *
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @returns {Promise<{token: string, user: Object}>}
   */
  async register({ email, password }) {
    // Hash password (even in demo mode — teaches the right pattern)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      role: config.adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
    };

    logger.info({ userId: user.id, email }, 'User registered (demo)');

    const token = this._signToken(user);
    return {
      token,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  /**
   * Authenticate a user with email + password.
   *
   * Demo mode: accepts any non-empty credentials and returns a valid JWT.
   * Production: would look up the user in the database and verify the hash.
   *
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @returns {Promise<{token: string, user: Object}>}
   */
  async login({ email, password }) {
    // ── Demo authentication ─────────────────────────────
    // In production, replace this block with a real DB lookup:
    //   const user = await UserModel.findByEmail(email);
    //   if (!user) throw ...
    //   const valid = await bcrypt.compare(password, user.password);
    //   if (!valid) throw ...
    // ────────────────────────────────────────────────────

    if (!email || !password) {
      throw Object.assign(
        new Error('Email and password are required'),
        { statusCode: 400 }
      );
    }

    const user = {
      id: uuidv4(),
      email,
      role: config.adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user',
    };

    logger.info({ userId: user.id, email }, 'User logged in (demo)');

    const token = this._signToken(user);
    return {
      token,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  /**
   * Create a guest session with limited privileges.
   *
   * @returns {{token: string, user: Object}}
   */
  createGuestSession() {
    const user = {
      id: `guest-${uuidv4()}`,
      email: null,
      role: 'guest',
    };

    logger.info({ userId: user.id }, 'Guest session created');

    const token = this._signToken(user);
    return {
      token,
      user: { id: user.id, role: user.role },
    };
  }

  /**
   * Sign a JWT for the given user payload.
   *
   * @private
   */
  _signToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret || 'dev-secret-do-not-use-in-production',
      { expiresIn: config.jwt.expiresIn }
    );
  }
}

module.exports = new AuthService();
