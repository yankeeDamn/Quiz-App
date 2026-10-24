'use strict';

const userService = require('../services/user.service');
const { isPlanActive } = require('../services/plan.service');

/**
 * GET /api/v1/user/profile — get current user profile
 */
async function getProfile(req, res, next) {
  try {
    if (req.isGuest) {
      return res.json({
        success: true,
        data: {
          user: { id: 'guest', role: 'guest' },
          isGuest: true,
        },
      });
    }

    const user = await userService.getById(req.user.id);

    if (!user) {
      return res.json({
        success: true,
        data: {
          user: req.user,
          isGuest: false,
        },
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          paymentStatus: user.payment_status,
          plan: user.plan || 'free',
          planActive: isPlanActive(user.plan, user.plan_expires_at),
          planExpiresAt: user.plan_expires_at,
          createdAt: user.created_at,
        },
        isGuest: false,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile };
