'use strict';

const { Router } = require('express');
const { allowNextAuthGuest } = require('../middleware/nextauth');
const userController = require('../controllers/user.controller');

const router = Router();

/**
 * GET /profile — get current user profile and payment status
 */
router.get('/profile', allowNextAuthGuest, userController.getProfile);

module.exports = router;
