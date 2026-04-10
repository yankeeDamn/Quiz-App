'use strict';

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// In-memory store for serverless (no DB dependency needed for Sokal Bela)
// In production, this would use a database. For Vercel serverless, consider
// using Vercel KV, Upstash Redis, or a PostgreSQL table.

/**
 * Book a Sokal Bela service.
 * @param {Object} data
 * @param {string} data.customerName
 * @param {string} data.customerEmail
 * @param {string} [data.customerPhone]
 * @param {string} data.serviceType
 * @param {string} data.preferredDate
 * @param {string} [data.preferredTime]
 * @param {string} [data.notes]
 * @returns {Object} booking
 */
function createBooking(data) {
  const {
    customerName,
    customerEmail,
    customerPhone = '',
    serviceType,
    preferredDate,
    preferredTime = '',
    notes = '',
  } = data;

  const booking = {
    id: uuidv4(),
    type: 'booking',
    customerName,
    customerEmail,
    customerPhone,
    serviceType,
    preferredDate,
    preferredTime,
    notes,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  logger.info({ bookingId: booking.id, serviceType }, 'Sokal Bela booking created');

  return booking;
}

/**
 * Place a Sokal Bela order.
 * @param {Object} data
 * @param {string} data.customerName
 * @param {string} data.customerEmail
 * @param {string} [data.customerPhone]
 * @param {Array<{itemName: string, quantity: number, pricePerUnit: number}>} data.items
 * @param {string} [data.deliveryAddress]
 * @param {string} [data.notes]
 * @returns {Object} order
 */
function createOrder(data) {
  const {
    customerName,
    customerEmail,
    customerPhone = '',
    items,
    deliveryAddress = '',
    notes = '',
  } = data;

  // Calculate total
  let totalAmount = 0;
  const validatedItems = items.map((item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Math.max(0, parseFloat(item.pricePerUnit) || 0);
    const subtotal = qty * price;
    totalAmount += subtotal;
    return {
      itemName: String(item.itemName).slice(0, 200),
      quantity: qty,
      pricePerUnit: price,
      subtotal,
    };
  });

  const order = {
    id: uuidv4(),
    type: 'order',
    customerName,
    customerEmail,
    customerPhone,
    items: validatedItems,
    totalAmount: Math.round(totalAmount * 100) / 100,
    deliveryAddress,
    notes,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  logger.info(
    { orderId: order.id, itemCount: validatedItems.length, totalAmount: order.totalAmount },
    'Sokal Bela order created'
  );

  return order;
}

module.exports = { createBooking, createOrder };
