'use strict';

const { validationResult } = require('express-validator');

/**
 * Express middleware that checks express-validator results.
 *
 * Place after your validation chains:
 *   router.post('/pay', [...validations], validate, controller);
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors.array().map((e) => ({
          field: e.path,
          message: e.msg,
        })),
      },
    });
  }
  next();
}

module.exports = { validate };
