const express = require('express');
const { Op, fn, col } = require('sequelize');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Guide = require('../models/Guide');
const { sequelize } = require('../database/connection');

const router = express.Router();

// Require that the current user is an admin (beta admin for now)
const requireAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.isBetaTester || user.betaAccessLevel !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    console.error('Admin check failed:', error);
    res.status(500).json({ message: 'Authorization check failed' });
  }
};

// GET /api/admin/stats - High-level platform stats
router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalGuides] = await Promise.all([
      User.count(),
      Guide.count()
    ]);

    const subscriptions = await User.findAll({
      attributes: ['subscription', [fn('COUNT', col('id')), 'count']],
      group: ['subscription']
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalGuides,
        subscriptions: subscriptions.map((row) => ({
          subscription: row.subscription,
          count: Number(row.get('count'))
        }))
      }
    });
  } catch (error) {
    console.error('Admin stats fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/users - List users with usage and simple activity info
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const where = {};
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset,
      limit,
      attributes: [
        'id',
        'email',
        'name',
        'subscription',
        'guidesUsed',
        'guidesLimit',
        'isBetaTester',
        'betaAccessLevel',
        'createdAt',
        'updatedAt'
      ]
    });

    const userIds = rows.map((u) => u.id);
    let guideStatsByUser = {};

    if (userIds.length > 0) {
      const guideStats = await Guide.findAll({
        attributes: [
          'userId',
          [fn('COUNT', col('id')), 'guidesCount'],
          [fn('MAX', col('createdAt')), 'lastGuideAt']
        ],
        where: { userId: { [Op.in]: userIds } },
        group: ['userId']
      });

      guideStatsByUser = guideStats.reduce((acc, row) => {
        const plain = row.get({ plain: true });
        acc[plain.userId] = {
          guidesCount: Number(plain.guidesCount || 0),
          lastGuideAt: plain.lastGuideAt
        };
        return acc;
      }, {});
    }

    const users = rows.map((u) => {
      const stats = guideStatsByUser[u.id] || { guidesCount: 0, lastGuideAt: null };
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        subscription: u.subscription,
        guidesUsed: u.guidesUsed,
        guidesLimit: u.guidesLimit,
        guidesCount: stats.guidesCount,
        lastGuideAt: stats.lastGuideAt,
        isBetaTester: u.isBetaTester,
        betaAccessLevel: u.betaAccessLevel,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      };
    });

    res.json({
      success: true,
      page,
      limit,
      total: count,
      users
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/guides - Adjust a user's guide limits/usage
router.put('/users/:id/guides', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { guidesLimit, guidesUsed, addGuides } = req.body || {};

    if (
      typeof guidesLimit === 'undefined' &&
      typeof guidesUsed === 'undefined' &&
      typeof addGuides === 'undefined'
    ) {
      return res.status(400).json({ message: 'No guide fields provided to update' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updates = {};

    if (typeof guidesLimit === 'number' && Number.isInteger(guidesLimit) && guidesLimit >= 0) {
      updates.guidesLimit = guidesLimit;
    }

    if (typeof guidesUsed === 'number' && Number.isInteger(guidesUsed) && guidesUsed >= 0) {
      updates.guidesUsed = guidesUsed;
    }

    if (typeof addGuides === 'number' && Number.isInteger(addGuides) && addGuides !== 0) {
      updates.guidesLimit = (updates.guidesLimit ?? user.guidesLimit) + addGuides;
    }

    await user.update(updates);

    res.json({
      success: true,
      message: 'Guide limits updated',
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription,
        guidesUsed: user.guidesUsed,
        guidesLimit: user.guidesLimit
      }
    });
  } catch (error) {
    console.error('Admin guides update error:', error);
    res.status(500).json({ message: 'Failed to update guide limits' });
  }
});

module.exports = router;


