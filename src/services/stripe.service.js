'use strict';

const Stripe = require('stripe');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Stripe service — encapsulates all Stripe interactions.
 *
 * Uses the Payment Intents API (replaces deprecated Charges API).
 */
class StripeService {
  constructor() {
    this.stripe = config.stripe.secretKey
      ? new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' })
      : null;

    if (!this.stripe) {
      logger.warn('Stripe secret key not configured — payment features disabled');
    }
  }

  /**
   * Create a PaymentIntent for the given amount.
   *
   * @param {Object} params
   * @param {number} params.amount  — amount in cents (server-authoritative)
   * @param {string} params.currency
   * @param {string} [params.customerEmail]
   * @param {Object} [params.metadata]
   * @returns {Promise<{clientSecret: string, paymentIntentId: string}>}
   */
  async createPaymentIntent({ amount, currency, customerEmail, metadata = {} }) {
    if (!this.stripe) {
      throw Object.assign(new Error('Stripe is not configured'), { statusCode: 503 });
    }

    // Server-side amount validation — prevent client tampering
    const validAmount = this._validateAmount(amount);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: validAmount,
      currency: currency || config.stripe.currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        ...(customerEmail && { customerEmail }),
      },
      ...(customerEmail && { receipt_email: customerEmail }),
    });

    logger.info(
      { paymentIntentId: paymentIntent.id, amount: validAmount },
      'PaymentIntent created'
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Verify and construct a Stripe webhook event.
   *
   * @param {Buffer}  rawBody  — raw request body
   * @param {string}  signature — Stripe-Signature header value
   * @returns {Stripe.Event}
   */
  constructWebhookEvent(rawBody, signature) {
    if (!this.stripe) {
      throw Object.assign(new Error('Stripe is not configured'), { statusCode: 503 });
    }

    if (!config.stripe.webhookSecret) {
      throw Object.assign(
        new Error('Stripe webhook secret not configured'),
        { statusCode: 503 }
      );
    }

    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret
    );
  }

  /**
   * Retrieve an existing PaymentIntent by ID.
   */
  async getPaymentIntent(paymentIntentId) {
    if (!this.stripe) {
      throw Object.assign(new Error('Stripe is not configured'), { statusCode: 503 });
    }
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Validate amount against the known product catalog.
   * Prevents client from sending an arbitrary (lower) amount.
   *
   * @private
   * @param {number} requestedAmount — amount in cents
   * @returns {number} validated amount
   */
  _validateAmount(requestedAmount) {
    const allowedAmounts = [config.stripe.fullAccessAmountCents];

    if (!allowedAmounts.includes(requestedAmount)) {
      throw Object.assign(
        new Error(
          `Invalid payment amount: ${requestedAmount}. Allowed: ${allowedAmounts.join(', ')}`
        ),
        { statusCode: 400 }
      );
    }

    return requestedAmount;
  }
}

// Export singleton
module.exports = new StripeService();
