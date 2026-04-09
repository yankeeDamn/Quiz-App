'use strict';

const stripeService = require('../services/stripe.service');
const userService = require('../services/user.service');
const config = require('../config');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * POST /api/v1/payments/create-payment-intent
 *
 * Creates a Stripe PaymentIntent and returns the client secret
 * so the frontend can confirm payment via Stripe.js.
 */
async function createPaymentIntent(req, res, next) {
  try {
    const { email } = req.body;

    // Amount is server-authoritative — never trust the client
    const result = await stripeService.createPaymentIntent({
      amount: config.stripe.fullAccessAmountCents,
      currency: config.stripe.currency,
      customerEmail: email || undefined,
      metadata: {
        userId: req.user?.id || 'anonymous',
        product: 'full_exam_access',
      },
    });

    res.status(201).json({
      success: true,
      data: {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        amount: config.stripe.fullAccessAmountCents,
        currency: config.stripe.currency,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payments/status/:paymentIntentId
 *
 * Retrieve the status of a PaymentIntent (useful for polling).
 */
async function getPaymentStatus(req, res, next) {
  try {
    const { paymentIntentId } = req.params;
    const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

    res.json({
      success: true,
      data: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payments/webhook
 *
 * Stripe webhook endpoint — verifies signature and processes events.
 *
 * IMPORTANT: This endpoint must receive the **raw** body (not JSON-parsed).
 * The route is registered BEFORE the global JSON body-parser in app.js.
 */
async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing Stripe-Signature header' },
      });
    }

    const event = stripeService.constructWebhookEvent(req.body, signature);

    logger.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        logger.info(
          { paymentIntentId: paymentIntent.id, amount: paymentIntent.amount },
          'Payment succeeded'
        );
        // Update user's payment status in database
        if (config.databaseUrl && paymentIntent.metadata?.userId) {
          try {
            await userService.updatePaymentStatus(paymentIntent.metadata.userId, 'paid');
            // Record payment in payments table
            await db.query(
              `INSERT INTO payments (user_id, stripe_payment_intent_id, amount_cents, currency, status)
               VALUES ($1, $2, $3, $4, 'succeeded')
               ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = 'succeeded', updated_at = NOW()`,
              [paymentIntent.metadata.userId, paymentIntent.id, paymentIntent.amount, paymentIntent.currency]
            );
            logger.info({ userId: paymentIntent.metadata.userId }, 'User payment status updated to paid');
          } catch (dbErr) {
            logger.error({ err: dbErr }, 'Failed to update payment status in DB');
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        logger.warn(
          {
            paymentIntentId: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message,
          },
          'Payment failed'
        );
        // Record failed payment
        if (config.databaseUrl && paymentIntent.metadata?.userId) {
          try {
            await db.query(
              `INSERT INTO payments (user_id, stripe_payment_intent_id, amount_cents, currency, status)
               VALUES ($1, $2, $3, $4, 'failed')
               ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = 'failed', updated_at = NOW()`,
              [paymentIntent.metadata.userId, paymentIntent.id, paymentIntent.amount, paymentIntent.currency]
            );
          } catch (dbErr) {
            logger.error({ err: dbErr }, 'Failed to record payment failure in DB');
          }
        }
        break;
      }

      default:
        logger.debug({ eventType: event.type }, 'Unhandled Stripe event type');
    }

    // Stripe expects a 200 response to acknowledge receipt
    res.json({ received: true });
  } catch (err) {
    // Signature verification failures should return 400
    if (err.type === 'StripeSignatureVerificationError') {
      logger.warn({ err }, 'Stripe webhook signature verification failed');
      return res.status(400).json({
        success: false,
        error: { message: 'Webhook signature verification failed' },
      });
    }
    next(err);
  }
}

/**
 * GET /api/v1/payments/config
 *
 * Returns the Stripe publishable key for frontend initialisation.
 */
function getStripeConfig(_req, res) {
  res.json({
    success: true,
    data: {
      publishableKey: config.stripe.publishableKey,
      amount: config.stripe.fullAccessAmountCents,
      currency: config.stripe.currency,
    },
  });
}

module.exports = {
  createPaymentIntent,
  getPaymentStatus,
  handleWebhook,
  getStripeConfig,
};
