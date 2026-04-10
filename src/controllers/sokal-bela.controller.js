'use strict';

const sokalBelaService = require('../services/sokal-bela.service');
const logger = require('../utils/logger');

/**
 * POST /api/v1/sokal-bela/book
 */
async function book(req, res, next) {
  try {
    const booking = sokalBelaService.createBooking(req.body);
    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking confirmed successfully',
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Sokal Bela booking error');
    next(err);
  }
}

/**
 * POST /api/v1/sokal-bela/order
 */
async function order(req, res, next) {
  try {
    const result = sokalBelaService.createOrder(req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Order placed successfully',
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Sokal Bela order error');
    next(err);
  }
}

module.exports = { book, order };
