'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const sokalBelaController = require('../controllers/sokal-bela.controller');

const router = Router();

// ── POST /api/v1/sokal-bela/book ─────────────────────────
router.post(
  '/book',
  [
    body('customerName')
      .trim()
      .notEmpty()
      .withMessage('Customer name is required')
      .isLength({ max: 200 })
      .withMessage('Customer name too long'),
    body('customerEmail')
      .trim()
      .isEmail()
      .withMessage('Valid email is required'),
    body('customerPhone')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Phone number too long'),
    body('serviceType')
      .trim()
      .notEmpty()
      .withMessage('Service type is required')
      .isLength({ max: 100 })
      .withMessage('Service type too long'),
    body('preferredDate')
      .trim()
      .notEmpty()
      .withMessage('Preferred date is required')
      .isISO8601()
      .withMessage('Date must be in ISO 8601 format'),
    body('preferredTime')
      .optional()
      .trim()
      .isLength({ max: 20 }),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes too long'),
    validate,
  ],
  sokalBelaController.book
);

// ── POST /api/v1/sokal-bela/order ────────────────────────
router.post(
  '/order',
  [
    body('customerName')
      .trim()
      .notEmpty()
      .withMessage('Customer name is required')
      .isLength({ max: 200 })
      .withMessage('Customer name too long'),
    body('customerEmail')
      .trim()
      .isEmail()
      .withMessage('Valid email is required'),
    body('customerPhone')
      .optional()
      .trim()
      .isLength({ max: 20 }),
    body('items')
      .isArray({ min: 1 })
      .withMessage('At least one item is required'),
    body('items.*.itemName')
      .trim()
      .notEmpty()
      .withMessage('Item name is required'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1'),
    body('items.*.pricePerUnit')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('deliveryAddress')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Address too long'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes too long'),
    validate,
  ],
  sokalBelaController.order
);

module.exports = router;
