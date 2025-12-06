const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const {
  supabaseAdmin,
  runAdminQuery,
  isSupabaseAdminConfigured,
  tables: supabaseTables,
  normalizeUserRow,
  normalizeGuideRow,
} = require('../lib/supabaseAdmin');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_USERS_TABLE = supabaseTables.users;
const SUPABASE_GUIDES_TABLE = supabaseTables.guides;
const hasUserModel = !!User;

function supabaseUnavailable(res) {
  if (!isSupabaseAdminConfigured()) {
    res
      .status(503)
      .json({ message: 'User data unavailable. Please try again shortly.' });
    return true;
  }
  return false;
}

async function executeSupabase(builderFn) {
  const result = await runAdminQuery(builderFn);
  if (!result) {
    throw new Error('Supabase admin client unavailable');
  }
  if (result.error) {
    throw new Error(result.error.message || 'Supabase query failed');
  }
  return result;
}

async function fetchSupabaseUser(userId) {
  if (!isSupabaseAdminConfigured()) return null;
  const { data } = await executeSupabase((client) =>
    client.from(SUPABASE_USERS_TABLE).select('*').eq('id', userId).maybeSingle()
  );
  return normalizeUserRow(data);
}

async function fetchSupabaseUserByEmail(email) {
  if (!isSupabaseAdminConfigured()) return null;
  const { data } = await executeSupabase((client) =>
    client.from(SUPABASE_USERS_TABLE).select('*').eq('email', email).maybeSingle()
  );
  return normalizeUserRow(data);
}

async function createSupabaseUser(userData) {
  if (!isSupabaseAdminConfigured()) return null;

  const { randomUUID } = require('crypto');
  const hashedPassword = await bcrypt.hash(userData.password, 12);

  const newUser = {
    id: randomUUID(),
    email: userData.email,
    password: hashedPassword,
    name: userData.name,
    subscription: userData.subscription || 'free',
    guidesLimit: userData.guidesLimit || 1,
    guidesUsed: userData.guidesUsed || 0,
    isBetaTester: userData.isBetaTester || false,
    betaAccessLevel: userData.betaAccessLevel || 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { data, error } = await executeSupabase((client) =>
    client.from(SUPABASE_USERS_TABLE).insert(newUser).select('*').single()
  );

  if (error) {
    throw new Error(error.message || 'Failed to create user in Supabase');
  }

  return normalizeUserRow(data);
}

async function compareSupabasePassword(email, candidatePassword) {
  const user = await fetchSupabaseUserByEmail(email);
  if (!user || !user.password) return { valid: false, user: null };

  const isValid = await bcrypt.compare(candidatePassword, user.password);
  return { valid: isValid, user: isValid ? user : null };
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    try {
      let user = null;

      if (hasUserModel) {
        // Sequelize path
        const existing = await User.findOne({ where: { email } });
        if (existing) {
          console.log(`🔒 Registration attempt with existing email: ${email} from IP: ${clientIP}`);
          return res.status(409).json({ message: 'Email already registered' });
        }

        user = await User.create({
          email,
          password,
          name,
          subscription: 'free',
          guidesLimit: 1,
          guidesUsed: 0
        });
      } else {
        // Supabase fallback
        if (supabaseUnavailable(res)) return;

        const existing = await fetchSupabaseUserByEmail(email);
        if (existing) {
          console.log(`🔒 Registration attempt with existing email: ${email} from IP: ${clientIP}`);
          return res.status(409).json({ message: 'Email already registered' });
        }

        user = await createSupabaseUser({
          email,
          password,
          name,
          subscription: 'free',
          guidesLimit: 1,
          guidesUsed: 0
        });
      }

      if (!user) {
        throw new Error('Failed to create user account');
      }

      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        subscription: user.subscription,
        isBetaTester: user.isBetaTester
      }, JWT_SECRET, { expiresIn: '30d' });

      console.log(`✅ New user registered: ${email} from IP: ${clientIP}`);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          subscription: user.subscription,
          guidesUsed: user.guidesUsed,
          guidesLimit: user.guidesLimit,
          isBetaTester: user.isBetaTester,
          betaAccessLevel: user.betaAccessLevel
        },
        token,
        message: 'Account created successfully! You can now generate your first acting guide.'
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Registration failed: ' + (err.message || 'Unknown error') });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    try {
      // Check for brute force attempts
      const failedAttempts = require('../middleware/auth').failedAttempts;
      const attemptKey = `${clientIP}:${email}`;
      const attempts = failedAttempts.get(attemptKey);

      if (attempts && attempts.count >= 5 && (Date.now() - attempts.timestamp) < 15 * 60 * 1000) {
        console.log(`🚫 Brute force attempt blocked: ${email} from IP: ${clientIP}`);
        return res.status(429).json({
          message: 'Too many failed login attempts. Please try again in 15 minutes.',
          retryAfter: Math.ceil((15 * 60 * 1000 - (Date.now() - attempts.timestamp)) / 1000)
        });
      }

      let user = null;
      let passwordValid = false;

      if (hasUserModel) {
        user = await User.findOne({ where: { email } });
        if (user) {
          passwordValid = await user.comparePassword(password);
        }
      } else {
        // Supabase fallback
        if (supabaseUnavailable(res)) return;
        const result = await compareSupabasePassword(email, password);
        user = result.user;
        passwordValid = result.valid;
      }

      if (!user || !passwordValid) {
        // Track failed attempt
        const currentAttempts = failedAttempts.get(attemptKey) || { count: 0, timestamp: Date.now() };
        currentAttempts.count++;
        currentAttempts.timestamp = Date.now();
        failedAttempts.set(attemptKey, currentAttempts);

        console.log(`🔒 Failed login attempt: ${email} from IP: ${clientIP}`);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Clear failed attempts on successful login
      failedAttempts.delete(attemptKey);

      // Check if user account is active
      if (user.betaStatus === 'expired') {
        console.log(`🔒 Login attempt with expired account: ${email} from IP: ${clientIP}`);
        return res.status(401).json({ message: 'Account access expired' });
      }

      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        subscription: user.subscription,
        isBetaTester: user.isBetaTester
      }, JWT_SECRET, { expiresIn: '30d' });

      console.log(`✅ Successful login: ${email} from IP: ${clientIP}`);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          subscription: user.subscription,
          guidesUsed: user.guidesUsed,
          guidesLimit: user.guidesLimit,
          isBetaTester: user.isBetaTester,
          betaAccessLevel: user.betaAccessLevel
        },
        token
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

// POST /api/auth/refresh - Refresh token
router.post('/refresh', auth, async (req, res) => {
  try {
    let user = null;
    if (hasUserModel) {
      user = await User.findByPk(req.userId);
    } else {
      if (supabaseUnavailable(res)) return;
      user = await fetchSupabaseUser(req.userId);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        guidesUsed: user.guidesUsed,
        guidesLimit: user.guidesLimit
      },
      token
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ message: 'Token refresh failed' });
  }
});

// GET /api/auth/profile - Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    let user = null;
    if (hasUserModel) {
      user = await User.findByPk(req.userId, {
        attributes: { exclude: ['password'] }
      });
    } else {
      if (supabaseUnavailable(res)) return;
      user = await fetchSupabaseUser(req.userId);
      if (user) delete user.password;
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/profile - Update user profile
router.put(
  '/profile',
  [
    auth,
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('email').optional().isEmail().normalizeEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      let user = null;
      if (hasUserModel) {
        user = await User.findByPk(req.userId);
      } else {
        if (supabaseUnavailable(res)) return;
        user = await fetchSupabaseUser(req.userId);
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { name, email } = req.body;
      const updates = {};

      if (name) updates.name = name;
      if (email && email !== user.email) {
        let existing = null;
        if (hasUserModel) {
          existing = await User.findOne({ where: { email } });
        } else {
          existing = await fetchSupabaseUserByEmail(email);
        }
        if (existing) {
          return res.status(409).json({ message: 'Email already in use' });
        }
        updates.email = email;
      }

      if (hasUserModel) {
        await user.update(updates);
      } else {
        updates.updatedAt = new Date().toISOString();
        await executeSupabase((client) =>
          client.from(SUPABASE_USERS_TABLE).update(updates).eq('id', req.userId)
        );
        user = { ...user, ...updates };
      }

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          subscription: user.subscription,
          guidesUsed: user.guidesUsed,
          guidesLimit: user.guidesLimit
        }
      });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ message: 'Profile update failed' });
    }
  }
);

// POST /api/auth/change-password - Change password
router.post(
  '/change-password',
  [
    auth,
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { currentPassword, newPassword } = req.body;
      let user = null;

      if (hasUserModel) {
        user = await User.findByPk(req.userId);
      } else {
        if (supabaseUnavailable(res)) return;
        user = await fetchSupabaseUser(req.userId);
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let isCurrentPasswordValid = false;
      if (hasUserModel) {
        isCurrentPasswordValid = await user.comparePassword(currentPassword);
      } else {
        isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      }

      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      if (hasUserModel) {
        await user.update({ password: newPassword });
      } else {
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await executeSupabase((client) =>
          client.from(SUPABASE_USERS_TABLE).update({
            password: hashedPassword,
            updatedAt: new Date().toISOString()
          }).eq('id', req.userId)
        );
      }

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('Password change error:', err);
      res.status(500).json({ message: 'Password change failed' });
    }
  }
);

// POST /api/auth/forgot-password - Request password reset
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email } = req.body;
      let user = null;

      if (hasUserModel) {
        user = await User.findOne({ where: { email } });
      } else if (isSupabaseAdminConfigured()) {
        user = await fetchSupabaseUserByEmail(email);
      }

      if (user) {
        // Generate reset token (in production, send email)
        const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
        console.log(`Password reset requested for ${email}. Token: ${resetToken}`);
      }

      // Always return success to prevent email enumeration
      res.json({ message: 'If an account with that email exists, a password reset link has been sent' });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ message: 'Password reset request failed' });
    }
  }
);

// POST /api/auth/reset-password - Reset password with token
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('newPassword').isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { token, newPassword } = req.body;

      const decoded = jwt.verify(token, JWT_SECRET);
      let user = null;

      if (hasUserModel) {
        user = await User.findByPk(decoded.userId);
      } else if (isSupabaseAdminConfigured()) {
        user = await fetchSupabaseUser(decoded.userId);
      }

      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      if (hasUserModel) {
        await user.update({ password: newPassword });
      } else {
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await executeSupabase((client) =>
          client.from(SUPABASE_USERS_TABLE).update({
            password: hashedPassword,
            updatedAt: new Date().toISOString()
          }).eq('id', decoded.userId)
        );
      }

      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }
      console.error('Password reset error:', err);
      res.status(500).json({ message: 'Password reset failed' });
    }
  }
);

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', auth, (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  console.log(`✅ User logged out: ${req.user?.email || req.userId} from IP: ${clientIP}`);
  res.json({ message: 'Logged out successfully' });
});

// DELETE /api/auth/account - Delete user account
router.delete('/account', auth, async (req, res) => {
  try {
    const { password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!password) {
      return res.status(400).json({ message: 'Password required to delete account' });
    }

    let user = null;
    if (hasUserModel) {
      user = await User.findByPk(req.userId);
    } else {
      if (supabaseUnavailable(res)) return;
      user = await fetchSupabaseUser(req.userId);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let isPasswordValid = false;
    if (hasUserModel) {
      isPasswordValid = await user.comparePassword(password);
    } else {
      isPasswordValid = await bcrypt.compare(password, user.password);
    }

    if (!isPasswordValid) {
      console.log(`🔒 Failed account deletion attempt: ${user.email} from IP: ${clientIP}`);
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (hasUserModel) {
      // Delete user's guides first
      const Guide = require('../models/Guide');
      if (Guide) {
        await Guide.destroy({ where: { userId: user.id } });
      }
      await user.destroy();
    } else {
      // Delete from Supabase
      await executeSupabase((client) =>
        client.from(SUPABASE_GUIDES_TABLE).delete().eq('userId', req.userId)
      );
      await executeSupabase((client) =>
        client.from(SUPABASE_USERS_TABLE).delete().eq('id', req.userId)
      );
    }

    console.log(`🗑️  Account deleted: ${user.email} from IP: ${clientIP}`);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ message: 'Account deletion failed' });
  }
});

// GET /api/auth/stats - Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.userId;
    let guides = [];

    if (hasUserModel) {
      const Guide = require('../models/Guide');
      if (Guide) {
        guides = await Guide.findAll({
          where: { userId },
          attributes: ['createdAt', 'updatedAt', 'viewCount']
        });
      }
    } else if (isSupabaseAdminConfigured()) {
      const { data } = await executeSupabase((client) =>
        client.from(SUPABASE_GUIDES_TABLE)
          .select('createdAt,updatedAt,viewCount')
          .eq('userId', userId)
      );
      guides = data || [];
    }

    const totalGuides = guides.length;
    const totalViews = guides.reduce((sum, guide) => sum + (guide.viewCount || 0), 0);
    const averageViews = totalGuides > 0 ? Math.round(totalViews / totalGuides) : 0;

    // Calculate monthly stats
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const guidesThisMonth = guides.filter(guide => new Date(guide.createdAt) >= thisMonth).length;

    res.json({
      totalGuides,
      totalViews,
      averageViews,
      guidesThisMonth,
      accountCreated: req.user?.createdAt,
      lastActive: req.user?.updatedAt
    });
  } catch (err) {
    console.error('Stats fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

// POST /api/auth/upgrade - Request subscription upgrade
router.post('/upgrade', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['basic', 'premium'];

    if (!validPlans.includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan specified' });
    }

    console.log(`💰 Upgrade request: ${req.user?.email || req.userId} wants ${plan} plan`);

    res.json({
      message: 'Upgrade request received. You will be contacted shortly.',
      requestedPlan: plan
    });
  } catch (err) {
    console.error('Upgrade request error:', err);
    res.status(500).json({ message: 'Upgrade request failed' });
  }
});

// GET /api/auth/verify - Verify token validity
router.get('/verify', auth, async (req, res) => {
  try {
    let user = null;
    if (hasUserModel) {
      user = await User.findByPk(req.userId);
    } else {
      if (supabaseUnavailable(res)) return;
      user = await fetchSupabaseUser(req.userId);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        guidesUsed: user.guidesUsed,
        guidesLimit: user.guidesLimit
      }
    });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(500).json({ message: 'Token verification failed' });
  }
});

const DASHBOARD_GUIDE_FIELDS = [
  'id',
  'guideId',
  'characterName',
  'productionTitle',
  'productionType',
  'roleSize',
  'genre',
  'createdAt',
  'updatedAt',
  'viewCount',
  'isPublic',
  'childGuideRequested',
  'childGuideCompleted',
  'generatedHtml',
].join(',');

// GET /api/auth/dashboard - Get comprehensive user dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.userId;
    let user = null;

    if (hasUserModel) {
      user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });
    } else {
      if (supabaseUnavailable(res)) return;
      user = await fetchSupabaseUser(userId);
      if (user) delete user.password;
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's guides
    let guideRecords = [];
    let GuideModel = null;
    try {
      GuideModel = require('../models/Guide');
    } catch (_) {
      GuideModel = null;
    }

    if (GuideModel) {
      guideRecords = await GuideModel.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        attributes: [
          'id', 'guideId', 'characterName', 'productionTitle',
          'productionType', 'roleSize', 'genre', 'createdAt', 'updatedAt',
          'viewCount', 'isPublic', 'childGuideRequested', 'childGuideCompleted', 'generatedHtml'
        ]
      });
    } else if (isSupabaseAdminConfigured()) {
      const { data } = await executeSupabase((client) =>
        client
          .from(SUPABASE_GUIDES_TABLE)
          .select(DASHBOARD_GUIDE_FIELDS)
          .eq('userId', userId)
          .order('createdAt', { ascending: false })
      );
      guideRecords = (data || []).map(normalizeGuideRow);
    }

    // Get subscription plans for comparison
    const PaymentService = require('../services/paymentService');
    const paymentService = new PaymentService();
    const plans = paymentService.getSubscriptionPlans();
    const currentPlan = plans[user.subscription || 'free'];

    // Calculate usage statistics
    const guides = guideRecords;
    const totalGuides = guides.length;
    const completedGuides = guides.filter(g => g.generatedHtml).length;
    const pendingGuides = guides.filter(g => !g.generatedHtml).length;
    const processingGuides = 0;

    // Get recent activity (last 5 guides)
    const recentGuides = guides.slice(0, 5);

    // Calculate subscription progress
    const guidesLimitValue =
      typeof user.guidesLimit === 'number' ? user.guidesLimit : Number(user.guidesLimit) || 0;
    const guidesUsedValue =
      typeof user.guidesUsed === 'number' ? user.guidesUsed : Number(user.guidesUsed) || 0;
    const usagePercentage =
      guidesLimitValue > 0 ? (guidesUsedValue / guidesLimitValue) * 100 : 0;
    const guidesRemaining = Math.max(0, guidesLimitValue - guidesUsedValue);

    // Get beta tester information if applicable
    let betaInfo = null;
    if (user.isBetaTester) {
      const BetaTesterService = require('../services/betaTesterService');
      const betaService = new BetaTesterService();
      try {
        betaInfo = await betaService.getBetaTesterDashboard(userId);
      } catch (error) {
        console.error('Error fetching beta info:', error);
        const accessDescription =
          typeof user.getBetaAccessDescription === 'function'
            ? user.getBetaAccessDescription()
            : user.betaAccessLevel || 'none';
        betaInfo = {
          isBetaTester: true,
          betaAccessLevel: user.betaAccessLevel || 'none',
          betaStatus: user.betaStatus || 'active',
          accessDescription
        };
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        guidesUsed: user.guidesUsed,
        guidesLimit: user.guidesLimit,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isBetaTester: user.isBetaTester,
        betaAccessLevel: user.betaAccessLevel
      },
      subscription: {
        currentPlan: currentPlan,
        usagePercentage: Math.round(usagePercentage * 100) / 100,
        guidesRemaining: guidesRemaining,
        isAtLimit: guidesLimitValue > 0 ? guidesUsedValue >= guidesLimitValue : false,
        canGenerateMore: guidesLimitValue === 0 || guidesUsedValue < guidesLimitValue
      },
      guides: {
        total: totalGuides,
        completed: completedGuides,
        pending: pendingGuides,
        processing: processingGuides,
        recent: recentGuides.map(guide => ({
          id: guide.id,
          guideId: guide.guideId,
          characterName: guide.characterName,
          productionTitle: guide.productionTitle,
          productionType: guide.productionType,
          roleSize: guide.roleSize,
          genre: guide.genre,
          createdAt: guide.createdAt,
          updatedAt: guide.updatedAt,
          viewCount: guide.viewCount,
          isPublic: guide.isPublic,
          childGuideRequested: guide.childGuideRequested,
          childGuideCompleted: guide.childGuideCompleted
        }))
      },
      statistics: {
        totalGuides,
        completedGuides,
        pendingGuides,
        processingGuides,
        averageGuidesPerMonth: totalGuides > 0 ? Math.round((totalGuides / Math.max(1, Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24 * 30)))) * 100) / 100 : 0
      },
      availablePlans: plans,
      beta: betaInfo
    });

  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard' });
  }
});

module.exports = router;
