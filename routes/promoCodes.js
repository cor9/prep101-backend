const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const PromoCode = require('../models/PromoCode');
const PromoCodeRedemption = require('../models/PromoCodeRedemption');
const User = require('../models/User');

const router = express.Router();

// POST /api/promo-codes/redeem - Redeem a promo code
router.post(
  '/redeem',
  [
    auth,
    body('code').trim().notEmpty().withMessage('Promo code is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { code } = req.body;
      const userId = req.userId;

      console.log(`🎟️  Promo code redemption attempt - Code: ${code}, User: ${userId}`);

      // Find the promo code
      const promoCode = await PromoCode.findByCode(code);
      if (!promoCode) {
        console.log(`❌ Promo code not found: ${code}`);
        return res.status(404).json({
          success: false,
          message: 'Invalid promo code'
        });
      }

      // Check if promo code can be redeemed by this user
      const canRedeem = await promoCode.canBeRedeemedBy(userId);
      if (!canRedeem.valid) {
        console.log(`❌ Cannot redeem promo code: ${canRedeem.reason}`);
        return res.status(400).json({
          success: false,
          message: canRedeem.reason
        });
      }

      // Redeem the promo code
      const redemption = await promoCode.redeem(userId);

      // Get the user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Grant guides to user
      if (promoCode.type === 'free_guides' && promoCode.guidesGranted > 0) {
        await user.increment('guidesLimit', { by: promoCode.guidesGranted });
        console.log(`✅ Granted ${promoCode.guidesGranted} guides to user ${userId}`);
      }

      // Reload user to get updated values
      await user.reload();

      console.log(`🎉 Promo code redeemed successfully - Code: ${code}, User: ${userId}`);

      res.json({
        success: true,
        message: `Promo code redeemed successfully! You received ${promoCode.guidesGranted} free guide${promoCode.guidesGranted > 1 ? 's' : ''}`,
        redemption: {
          id: redemption.id,
          guidesGranted: redemption.guidesGranted,
          redeemedAt: redemption.redeemedAt
        },
        user: {
          guidesLimit: user.guidesLimit,
          guidesUsed: user.guidesUsed,
          guidesRemaining: Math.max(0, user.guidesLimit - user.guidesUsed)
        }
      });

    } catch (error) {
      console.error('❌ Promo code redemption error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to redeem promo code'
      });
    }
  }
);

// GET /api/promo-codes/my-redemptions - Get user's promo code redemptions
router.get('/my-redemptions', auth, async (req, res) => {
  try {
    const userId = req.userId;

    const redemptions = await PromoCodeRedemption.findAll({
      where: { userId },
      include: [{
        model: PromoCode,
        attributes: ['code', 'description', 'type']
      }],
      order: [['redeemedAt', 'DESC']]
    });

    res.json({
      success: true,
      redemptions: redemptions,
      total: redemptions.length
    });

  } catch (error) {
    console.error('Error fetching redemptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch redemptions'
    });
  }
});

// Admin routes - require admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);

    // Check if user is admin or owner email
    const ownerEmail = process.env.OWNER_EMAIL;
    if (user && (user.email === ownerEmail || user.betaAccessLevel === 'admin')) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify admin status'
    });
  }
};

// POST /api/promo-codes/create - Create a new promo code (admin only)
router.post(
  '/create',
  [
    auth,
    requireAdmin,
    body('code').trim().notEmpty().isLength({ min: 3, max: 50 }),
    body('description').optional().trim(),
    body('type').isIn(['free_guides', 'discount', 'upgrade']),
    body('guidesGranted').optional().isInt({ min: 0, max: 100 }),
    body('maxRedemptions').optional().isInt({ min: 1 }),
    body('maxRedemptionsPerUser').optional().isInt({ min: 1 }),
    body('expiresAt').optional().isISO8601()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.userId;
      const {
        code,
        description,
        type,
        guidesGranted,
        discountPercent,
        maxRedemptions,
        maxRedemptionsPerUser,
        expiresAt,
        notes
      } = req.body;

      // Create promo code
      const promoCode = await PromoCode.create({
        code: code.toUpperCase(),
        description,
        type,
        guidesGranted: type === 'free_guides' ? (guidesGranted || 1) : 0,
        discountPercent: type === 'discount' ? discountPercent : null,
        maxRedemptions,
        maxRedemptionsPerUser: maxRedemptionsPerUser || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: userId,
        notes
      });

      console.log(`✅ Promo code created - Code: ${promoCode.code}, Type: ${promoCode.type}`);

      res.status(201).json({
        success: true,
        message: 'Promo code created successfully',
        promoCode: {
          id: promoCode.id,
          code: promoCode.code,
          description: promoCode.description,
          type: promoCode.type,
          guidesGranted: promoCode.guidesGranted,
          maxRedemptions: promoCode.maxRedemptions,
          expiresAt: promoCode.expiresAt
        }
      });

    } catch (error) {
      console.error('Error creating promo code:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Promo code already exists'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Failed to create promo code'
      });
    }
  }
);

// GET /api/promo-codes/admin/all - Get all promo codes (admin only)
router.get('/admin/all', [auth, requireAdmin], async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const whereClause = includeInactive === 'true' ? {} : { isActive: true };

    const promoCodes = await PromoCode.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'email', 'name']
      }]
    });

    res.json({
      success: true,
      promoCodes: promoCodes,
      total: promoCodes.length
    });

  } catch (error) {
    console.error('Error fetching promo codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promo codes'
    });
  }
});

// GET /api/promo-codes/admin/:id/redemptions - Get redemptions for a promo code (admin only)
router.get('/admin/:id/redemptions', [auth, requireAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    const redemptions = await PromoCodeRedemption.findAll({
      where: { promoCodeId: id },
      include: [{
        model: User,
        attributes: ['id', 'email', 'name']
      }],
      order: [['redeemedAt', 'DESC']]
    });

    res.json({
      success: true,
      redemptions: redemptions,
      total: redemptions.length
    });

  } catch (error) {
    console.error('Error fetching redemptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch redemptions'
    });
  }
});

// PUT /api/promo-codes/admin/:id/deactivate - Deactivate a promo code (admin only)
router.put('/admin/:id/deactivate', [auth, requireAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    const promoCode = await PromoCode.findByPk(id);
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    await promoCode.update({ isActive: false });

    console.log(`🚫 Promo code deactivated - Code: ${promoCode.code}`);

    res.json({
      success: true,
      message: 'Promo code deactivated successfully',
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        isActive: promoCode.isActive
      }
    });

  } catch (error) {
    console.error('Error deactivating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate promo code'
    });
  }
});

// DELETE /api/promo-codes/admin/:id - Delete a promo code (admin only)
router.delete('/admin/:id', [auth, requireAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    const promoCode = await PromoCode.findByPk(id);
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    // Check if it has been redeemed
    const redemptionCount = await PromoCodeRedemption.count({
      where: { promoCodeId: id }
    });

    if (redemptionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete promo code that has been redeemed ${redemptionCount} time(s). Deactivate it instead.`
      });
    }

    await promoCode.destroy();

    console.log(`🗑️  Promo code deleted - Code: ${promoCode.code}`);

    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete promo code'
    });
  }
});

module.exports = router;
