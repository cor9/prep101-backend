const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const BetaTesterService = require('../services/betaTesterService');

const router = express.Router();
const betaTesterService = new BetaTesterService();

// Admin middleware - check if user is admin beta tester
const requireAdminBeta = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user.isBetaTester || user.betaAccessLevel !== 'admin') {
      return res.status(403).json({ message: 'Admin beta access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authorization check failed' });
  }
};

// Beta tester middleware - check if user is any type of beta tester
const requireBetaAccess = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user.isBetaTester) {
      return res.status(403).json({ message: 'Beta tester access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authorization check failed' });
  }
};

// POST /api/beta/invite - Invite new beta tester (admin only)
router.post(
  '/invite',
  [
    requireAdminBeta,
    body('email').isEmail().normalizeEmail(),
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('accessLevel').isIn(['early', 'premium', 'admin']),
    body('features').optional().isArray()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, name, accessLevel, features } = req.body;
      const invitedBy = req.userId;

      const result = await betaTesterService.inviteBetaTester(
        email, 
        name, 
        accessLevel, 
        invitedBy, 
        features
      );

      res.status(201).json({
        message: 'Beta tester invited successfully',
        ...result
      });

    } catch (error) {
      console.error('Error inviting beta tester:', error);
      res.status(500).json({ message: 'Failed to invite beta tester' });
    }
  }
);

// GET /api/beta/testers - Get all beta testers (admin only)
router.get('/testers', requireAdminBeta, async (req, res) => {
  try {
    const { status } = req.query;
    const betaTesters = await betaTesterService.getAllBetaTesters(status);

    res.json({ betaTesters });
  } catch (error) {
    console.error('Error fetching beta testers:', error);
    res.status(500).json({ message: 'Failed to fetch beta testers' });
  }
});

// GET /api/beta/stats - Get beta tester statistics (admin only)
router.get('/stats', requireAdminBeta, async (req, res) => {
  try {
    const stats = await betaTesterService.getBetaTesterStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching beta tester stats:', error);
    res.status(500).json({ message: 'Failed to fetch beta tester statistics' });
  }
});

// PUT /api/beta/testers/:id/access - Update beta tester access level (admin only)
router.put(
  '/testers/:id/access',
  [
    requireAdminBeta,
    body('accessLevel').isIn(['early', 'premium', 'admin']),
    body('features').optional().isArray()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { accessLevel, features } = req.body;

      const result = await betaTesterService.updateBetaTesterAccess(id, accessLevel, features);

      res.json(result);
    } catch (error) {
      console.error('Error updating beta tester access:', error);
      res.status(500).json({ message: 'Failed to update beta tester access' });
    }
  }
);

// POST /api/beta/testers/:id/end - End beta testing for a user (admin only)
router.post('/testers/:id/end', requireAdminBeta, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await betaTesterService.endBetaTesting(id);

    res.json(result);
  } catch (error) {
    console.error('Error ending beta testing:', error);
    res.status(500).json({ message: 'Failed to end beta testing' });
  }
});

// GET /api/beta/dashboard - Get beta tester dashboard (for beta testers)
router.get('/dashboard', requireBetaAccess, async (req, res) => {
  try {
    const userId = req.userId;
    const dashboard = await betaTesterService.getBetaTesterDashboard(userId);

    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching beta tester dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch beta tester dashboard' });
  }
});

// POST /api/beta/feedback - Submit beta tester feedback
router.post(
  '/feedback',
  [
    requireBetaAccess,
    body('feedback').trim().isLength({ min: 10, max: 2000 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.userId;
      const { feedback } = req.body;

      const result = await betaTesterService.submitFeedback(userId, feedback);

      res.json(result);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ message: 'Failed to submit feedback' });
    }
  }
);

// GET /api/beta/features - Get available beta features
router.get('/features', async (req, res) => {
  try {
    const features = betaTesterService.getAvailableFeatures();
    res.json({ features });
  } catch (error) {
    console.error('Error fetching beta features:', error);
    res.status(500).json({ message: 'Failed to fetch beta features' });
  }
});

// POST /api/beta/activate - Activate beta tester (called on first login)
router.post('/activate', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;

    if (!user.isBetaTester) {
      return res.status(400).json({ message: 'User is not a beta tester' });
    }

    if (user.betaStatus === 'active') {
      return res.json({ message: 'Beta tester already active' });
    }

    const result = await betaTesterService.activateBetaTester(userId);

    res.json(result);
  } catch (error) {
    console.error('Error activating beta tester:', error);
    res.status(500).json({ message: 'Failed to activate beta tester' });
  }
});

// GET /api/beta/check-access/:feature - Check if user has access to specific beta feature
router.get('/check-access/:feature', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { feature } = req.params;

    const hasAccess = await betaTesterService.hasFeatureAccess(userId, feature);

    res.json({
      hasAccess,
      feature,
      message: hasAccess ? 'Access granted' : 'Access denied'
    });
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({ message: 'Failed to check feature access' });
  }
});

// GET /api/beta/invitation-status - Check if user has pending beta invitation
router.get('/invitation-status', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email parameter required' });
    }

    const user = await require('../models/User').findOne({
      where: { email, isBetaTester: true },
      attributes: ['id', 'email', 'betaStatus', 'betaAccessLevel', 'betaInvitedAt']
    });

    if (!user) {
      return res.json({ hasInvitation: false });
    }

    res.json({
      hasInvitation: true,
      betaStatus: user.betaStatus,
      betaAccessLevel: user.betaAccessLevel,
      invitedAt: user.betaInvitedAt
    });

  } catch (error) {
    console.error('Error checking invitation status:', error);
    res.status(500).json({ message: 'Failed to check invitation status' });
  }
});

module.exports = router;
