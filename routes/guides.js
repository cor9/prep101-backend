const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { checkSubscription, trackGuideUsage } = require('../middleware/security');
const Guide = require('../models/Guide');
const User = require('../models/User');
const { Op } = require('sequelize'); // Added Op for search queries
const {
  runAdminQuery,
  isSupabaseAdminConfigured,
  tables: supabaseTables,
  normalizeGuideRow,
  normalizeUserRow,
} = require('../lib/supabaseAdmin');

const router = express.Router();
const SUPABASE_GUIDES_TABLE = supabaseTables.guides;
const SUPABASE_USERS_TABLE = supabaseTables.users;
const hasGuideModel = !!Guide;
const hasUserModel = !!User;
const hasSequelize = hasGuideModel;
const hasSupabaseFallback = isSupabaseAdminConfigured();
const GUIDE_SUMMARY_FIELDS = [
  'id',
  'guideId',
  'characterName',
  'productionTitle',
  'productionType',
  'roleSize',
  'genre',
  'createdAt',
  'viewCount',
  'childGuideRequested',
  'childGuideCompleted',
  'childGuideHtml',
  'isFavorite',
].join(',');
const GUIDE_DETAIL_FIELDS = [
  'id',
  'guideId',
  'characterName',
  'productionTitle',
  'productionType',
  'roleSize',
  'genre',
  'storyline',
  'characterBreakdown',
  'callbackNotes',
  'focusArea',
  'sceneText',
  'generatedHtml',
  'createdAt',
  'updatedAt',
  'viewCount',
  'isPublic',
  'childGuideRequested',
  'childGuideCompleted',
  'childGuideHtml',
  'isFavorite',
].join(',');

function supabaseUnavailable(res) {
  if (!isSupabaseAdminConfigured()) {
    res
      .status(503)
      .json({ message: 'Guide storage unavailable. Please try again shortly.' });
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
  const result = await executeSupabase((client) =>
    client.from(SUPABASE_USERS_TABLE).select('*').eq('id', userId).maybeSingle()
  );
  return normalizeUserRow(result.data);
}

// GET /api/guides - Get user's guides
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.userId;

    if (hasGuideModel) {
      const guides = await Guide.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        attributes: [
          'id',
          'guideId',
          'characterName',
          'productionTitle',
          'productionType',
          'roleSize',
          'genre',
          'createdAt',
          'viewCount',
          'childGuideRequested',
          'childGuideCompleted',
          'childGuideHtml',
          'isFavorite',
        ],
      });

      res.json({
        success: true,
        guides,
        total: guides.length,
      });
      return;
    }

    if (supabaseUnavailable(res)) return;

    const { data } = await executeSupabase((client) =>
      client
        .from(SUPABASE_GUIDES_TABLE)
        .select(GUIDE_SUMMARY_FIELDS)
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
    );

    const guides = (data || []).map(normalizeGuideRow);

    res.json({
      success: true,
      guides,
      total: guides.length,
    });
  } catch (error) {
    console.error('Error fetching guides:', error);
    res.status(500).json({ message: 'Failed to fetch guides' });
  }
});

// GET /api/guides/public - Get public guides (no auth required)
router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Sequelize (primary)
    if (hasSequelize) {
      const { count, rows: guides } = await Guide.findAndCountAll({
        where: { isPublic: true },
        order: [[sortBy, order.toUpperCase()]],
        limit: parseInt(limit),
        offset: offset,
        attributes: [
          'id', 'guideId', 'characterName', 'productionTitle',
          'productionType', 'createdAt', 'viewCount'
        ]
      });

      return res.json({
        guides,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalGuides: count,
          guidesPerPage: parseInt(limit)
        }
      });
    }

    // Supabase fallback
    if (!hasSupabaseFallback) {
      return res.status(503).json({ message: 'Database service unavailable' });
    }

    const { data, count } = await executeSupabase((client) =>
      client
        .from(SUPABASE_GUIDES_TABLE)
        .select('id,guideId,characterName,productionTitle,productionType,createdAt,viewCount', { count: 'exact' })
        .eq('isPublic', true)
        .order(sortBy, { ascending: order.toUpperCase() === 'ASC' })
        .range(offset, offset + parseInt(limit) - 1)
    );

    const guides = (data || []).map(normalizeGuideRow);

    res.json({
      guides,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil((count || 0) / parseInt(limit)),
        totalGuides: count || 0,
        guidesPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Public guides fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch public guides' });
  }
});

// GET /api/guides/public/:id - Get specific public guide
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Sequelize (primary)
    if (hasSequelize) {
      const guide = await Guide.findOne({
        where: { id, isPublic: true },
        attributes: [
          'id', 'guideId', 'characterName', 'productionTitle',
          'productionType', 'createdAt', 'viewCount', 'generatedHtml'
        ]
      });

      if (!guide) {
        return res.status(404).json({ message: 'Public guide not found' });
      }

      // Increment view count
      await guide.increment('viewCount');

      return res.json({ guide });
    }

    // Supabase fallback
    if (!hasSupabaseFallback) {
      return res.status(503).json({ message: 'Database service unavailable' });
    }

    const { data } = await executeSupabase((client) =>
      client
        .from(SUPABASE_GUIDES_TABLE)
        .select('id,guideId,characterName,productionTitle,productionType,createdAt,viewCount,generatedHtml,isPublic')
        .eq('id', id)
        .eq('isPublic', true)
        .maybeSingle()
    );

    const guide = normalizeGuideRow(data);
    if (!guide) {
      return res.status(404).json({ message: 'Public guide not found' });
    }

    // Increment view count
    await executeSupabase((client) =>
      client
        .from(SUPABASE_GUIDES_TABLE)
        .update({ viewCount: (guide.viewCount || 0) + 1 })
        .eq('id', id)
    );

    res.json({ guide });

  } catch (error) {
    console.error('Public guide fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch public guide' });
  }
});

// GET /api/guides/:id/child - Get child guide HTML
router.get('/:id/child', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    console.log(`🔍 Child guide request - Guide ID: ${id}, User ID: ${userId}`);

    let guide = null;
    if (hasGuideModel) {
      guide = await Guide.findOne({
        where: { id, userId },
        attributes: [
          'id',
          'characterName',
          'productionTitle',
          'childGuideHtml',
          'childGuideCompleted',
          'childGuideRequested',
        ],
      });
    } else {
      if (supabaseUnavailable(res)) return;
      const { data } = await executeSupabase((client) =>
        client
          .from(SUPABASE_GUIDES_TABLE)
          .select(
            'id,characterName,productionTitle,childGuideHtml,childGuideCompleted,childGuideRequested'
          )
          .eq('id', id)
          .eq('userId', userId)
          .maybeSingle()
      );
      guide = normalizeGuideRow(data);
    }

    console.log(`🔍 Guide found:`, {
      found: !!guide,
      id: guide?.id,
      characterName: guide?.characterName,
      childGuideRequested: guide?.childGuideRequested,
      childGuideCompleted: guide?.childGuideCompleted,
      hasChildGuideHtml: !!guide?.childGuideHtml,
      childGuideHtmlLength: guide?.childGuideHtml?.length || 0
    });

    if (!guide) {
      console.log('❌ Guide not found');
      return res.status(404).json({ message: 'Guide not found' });
    }

    if (!guide.childGuideCompleted || !guide.childGuideHtml) {
      console.log('❌ Child guide not available:', {
        completed: guide.childGuideCompleted,
        hasHtml: !!guide.childGuideHtml
      });
      return res.status(404).json({ message: 'Child guide not available' });
    }

    console.log('✅ Child guide found, sending HTML content');
    // Set HTML content type and send the child guide
    res.setHeader('Content-Type', 'text/html');
    res.send(guide.childGuideHtml);

  } catch (error) {
    console.error('❌ Child guide fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch child guide' });
  }
});

// GET /api/guides/:id - Get specific guide
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    let guide = null;
    if (hasGuideModel) {
      guide = await Guide.findOne({
        where: { id, userId },
        attributes: { exclude: ['scriptContent'] } // Don't send full script content
      });
    } else {
      if (supabaseUnavailable(res)) return;
      const { data } = await executeSupabase((client) =>
        client
          .from(SUPABASE_GUIDES_TABLE)
          .select(GUIDE_DETAIL_FIELDS)
          .eq('id', id)
          .eq('userId', userId)
          .maybeSingle()
      );
      guide = normalizeGuideRow(data);
    }

    if (!guide) {
      return res.status(404).json({ message: 'Guide not found' });
    }

    res.json({
      success: true,
      guide: guide
    });
  } catch (error) {
    console.error('Error fetching guide:', error);
    res.status(500).json({ message: 'Failed to fetch guide' });
  }
});

// POST /api/guides - Create new guide (with subscription check)
router.post(
  '/',
  [
    auth,
    checkSubscription('free'), // Allow free users but track usage
    trackGuideUsage,
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('characterName').trim().isLength({ min: 1, max: 100 }),
    body('productionTitle').trim().isLength({ min: 1, max: 200 }),
    body('productionType').trim().isLength({ min: 1, max: 100 }),
    body('productionTone').optional().trim().isLength({ min: 0, max: 200 }),
    body('stakes').optional().trim().isLength({ min: 0, max: 200 }),
    body('scriptContent').isLength({ min: 10 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.userId;
      const { title, characterName, productionTitle, productionType, productionTone, stakes, scriptContent } = req.body;

      // Create guide
      const guide = await Guide.create({
        userId,
        title,
        characterName,
        productionTitle,
        productionType,
        productionTone,
        stakes,
        scriptContent,
        status: 'pending'
      });

      res.status(201).json({
        message: 'Guide created successfully',
        guide: {
          id: guide.id,
          title: guide.title,
          characterName: guide.characterName,
          productionTitle: guide.productionTitle,
          productionType: guide.productionType,
          status: guide.status,
          createdAt: guide.createdAt
        }
      });
    } catch (error) {
      console.error('Error creating guide:', error);
      res.status(500).json({ message: 'Failed to create guide' });
    }
  }
);

// PUT /api/guides/:id - Update guide
router.put(
  '/:id',
  [
    auth,
    body('title').optional().trim().isLength({ min: 1, max: 200 }),
    body('characterName').optional().trim().isLength({ min: 1, max: 100 }),
    body('productionTitle').optional().trim().isLength({ min: 1, max: 200 }),
    body('productionType').optional().trim().isLength({ min: 1, max: 100 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const userId = req.userId;
      const updates = req.body;

      const guide = await Guide.findOne({ where: { id, userId } });
      if (!guide) {
        return res.status(404).json({ message: 'Guide not found' });
      }

      await guide.update(updates);

      res.json({
        message: 'Guide updated successfully',
        guide: {
          id: guide.id,
          title: guide.title,
          characterName: guide.characterName,
          productionTitle: guide.productionTitle,
          productionType: guide.productionType,
          status: guide.status,
          updatedAt: guide.updatedAt
        }
      });
    } catch (error) {
      console.error('Error updating guide:', error);
      res.status(500).json({ message: 'Failed to update guide' });
    }
  }
);

// DELETE /api/guides/:id - Delete guide
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    if (hasGuideModel) {
      const guide = await Guide.findOne({ where: { id, userId } });
      if (!guide) {
        return res.status(404).json({ message: 'Guide not found' });
      }

      await guide.destroy();
      res.json({ message: 'Guide deleted successfully' });
      return;
    }

    if (supabaseUnavailable(res)) return;

    const { data: existingGuide } = await executeSupabase((client) =>
      client
        .from(SUPABASE_GUIDES_TABLE)
        .select('id')
        .eq('id', id)
        .eq('userId', userId)
        .maybeSingle()
    );

    if (!existingGuide) {
      return res.status(404).json({ message: 'Guide not found' });
    }

    await executeSupabase((client) =>
      client.from(SUPABASE_GUIDES_TABLE).delete().eq('id', id).eq('userId', userId)
    );

    res.json({ message: 'Guide deleted successfully' });
  } catch (error) {
    console.error('Error deleting guide:', error);
    res.status(500).json({ message: 'Failed to delete guide' });
  }
});

// POST /api/guides/:id/generate - Generate guide content
router.post(
  '/:id/generate',
  [
    auth,
    checkSubscription('free'),
    trackGuideUsage
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const guide = await Guide.findOne({ where: { id, userId } });
      if (!guide) {
        return res.status(404).json({ message: 'Guide not found' });
      }

      if (guide.status === 'completed') {
        return res.status(400).json({ message: 'Guide already generated' });
      }

      // Here you would integrate with your AI service to generate the guide
      // For now, we'll simulate the process

      // Update guide status to processing
      await guide.update({ status: 'processing' });

      // Simulate AI processing delay
      setTimeout(async () => {
        try {
          const generatedContent = `Generated guide for ${guide.characterName} in ${guide.productionTitle}...`;
          await guide.update({
            guideContent: generatedContent,
            status: 'completed'
          });
        } catch (error) {
          console.error('Error updating guide after generation:', error);
          await guide.update({ status: 'failed' });
        }
      }, 2000);

      res.json({
        message: 'Guide generation started',
        guide: {
          id: guide.id,
          status: guide.status
        }
      });

    } catch (error) {
      console.error('Error starting guide generation:', error);
      res.status(500).json({ message: 'Failed to start guide generation' });
    }
  }
);

// GET /api/guides/:id/status - Check guide generation status
router.get('/:id/status', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const guide = await Guide.findOne({
      where: { id, userId },
      attributes: ['id', 'status', 'guideContent', 'updatedAt']
    });

    if (!guide) {
      return res.status(404).json({ message: 'Guide not found' });
    }

    res.json({
      guide: {
        id: guide.id,
        status: guide.status,
        guideContent: guide.guideContent,
        updatedAt: guide.updatedAt
      }
    });
  } catch (error) {
    console.error('Error checking guide status:', error);
    res.status(500).json({ message: 'Failed to check guide status' });
  }
});

// GET /api/guides/search - Search user's guides
router.get('/search', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { q, status, characterName, productionType, sortBy = 'createdAt', order = 'DESC' } = req.query;

    let whereClause = { userId };

    // Add search filters
    if (q) {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { title: { [Op.iLike]: `%${q}%` } },
          { characterName: { [Op.iLike]: `%${q}%` } },
          { productionTitle: { [Op.iLike]: `%${q}%` } },
          { productionType: { [Op.iLike]: `%${q}%` } }
        ]
      };
    }

    if (status) {
      whereClause.status = status;
    }

    if (characterName) {
      whereClause.characterName = { [Op.iLike]: `%${characterName}%` };
    }

    if (productionType) {
      whereClause.productionType = { [Op.iLike]: `%${productionType}%` };
    }

    const guides = await Guide.findAll({
      where: whereClause,
      order: [[sortBy, order.toUpperCase()]],
      attributes: [
        'id', 'title', 'characterName', 'productionTitle',
        'productionType', 'status', 'createdAt', 'updatedAt',
        'viewCount', 'isPublic'
      ]
    });

    res.json({ guides, total: guides.length });
  } catch (error) {
    console.error('Guide search error:', error);
    res.status(500).json({ message: 'Failed to search guides' });
  }
});

// GET /api/guides/stats - Get user's guide statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.userId;

    const guides = await Guide.findAll({
      where: { userId },
      attributes: ['status', 'createdAt', 'viewCount']
    });

    // Calculate statistics
    const totalGuides = guides.length;
    const statusCounts = guides.reduce((acc, guide) => {
      acc[guide.status] = (acc[guide.status] || 0) + 1;
      return acc;
    }, {});

    const monthlyStats = guides.reduce((acc, guide) => {
      const month = new Date(guide.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) acc[month] = 0;
      acc[month]++;
      return acc;
    }, {});

    const totalViews = guides.reduce((sum, guide) => sum + (guide.viewCount || 0), 0);
    const averageViews = totalGuides > 0 ? Math.round(totalViews / totalGuides * 100) / 100 : 0;

    res.json({
      totalGuides,
      statusCounts,
      monthlyStats,
      totalViews,
      averageViews,
      recentMonths: Object.keys(monthlyStats).sort().slice(-6) // Last 6 months
    });

  } catch (error) {
    console.error('Guide stats error:', error);
    res.status(500).json({ message: 'Failed to fetch guide statistics' });
  }
});

// PUT /api/guides/:id/share - Toggle guide public/private status
router.put('/:id/share', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { isPublic } = req.body;

    const guide = await Guide.findOne({ where: { id, userId } });
    if (!guide) {
      return res.status(404).json({ message: 'Guide not found' });
    }

    await guide.update({ isPublic: Boolean(isPublic) });

    res.json({
      message: `Guide ${isPublic ? 'made public' : 'made private'}`,
      guide: {
        id: guide.id,
        isPublic: guide.isPublic
      }
    });

  } catch (error) {
    console.error('Guide share toggle error:', error);
    res.status(500).json({ message: 'Failed to update guide sharing' });
  }
});

// GET /api/guides/:id/full - Get full guide details (for user's own guides)
router.get('/:id/full', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    let guide = null;
    if (hasGuideModel) {
      guide = await Guide.findOne({
        where: { id, userId }
      });
    } else {
      if (supabaseUnavailable(res)) return;
      const { data } = await executeSupabase((client) =>
        client
          .from(SUPABASE_GUIDES_TABLE)
          .select(GUIDE_DETAIL_FIELDS)
          .eq('id', id)
          .eq('userId', userId)
          .maybeSingle()
      );
      guide = normalizeGuideRow(data);
    }

    if (!guide) {
      return res.status(404).json({ message: 'Guide not found' });
    }

    res.json({ guide });

  } catch (error) {
    console.error('Full guide fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch guide details' });
  }
});

// POST /api/guides/:id/email - Send guide via email
router.post('/:id/email', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    console.log(`📧 Email endpoint - Guide ID: ${id}, User ID: ${userId}`);

    let guide = null;
    if (hasGuideModel) {
      guide = await Guide.findOne({
        where: { id, userId },
        attributes: [
          'id',
          'guideId',
          'characterName',
          'productionTitle',
          'productionType',
          'roleSize',
          'genre',
          'storyline',
          'characterBreakdown',
          'callbackNotes',
          'focusArea',
          'sceneText',
          'generatedHtml',
          'createdAt',
          'viewCount'
        ]
      });
    } else {
      if (supabaseUnavailable(res)) return;
      const { data } = await executeSupabase((client) =>
        client
          .from(SUPABASE_GUIDES_TABLE)
          .select(GUIDE_DETAIL_FIELDS)
          .eq('id', id)
          .eq('userId', userId)
          .maybeSingle()
      );
      guide = normalizeGuideRow(data);
    }

    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    let user = null;
    if (hasUserModel) {
      user = await User.findByPk(userId);
    } else {
      user = await fetchSupabaseUser(userId);
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!guide.generatedHtml) {
      return res.status(400).json({ error: 'Guide content is not available for email' });
    }

    const emailService = require('../services/emailService');
    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: 'Email service not configured. Please set RESEND_API_KEY.' });
    }

    const subject = `Your Prep101 guide for ${guide.characterName} - ${guide.productionTitle}`;
    const html = guide.generatedHtml;

    await emailService.sendGuideEmail({
      to: user.email,
      subject,
      html
    });

    console.log(`📧 Guide emailed to ${user.email} for guide ${guide.id}`);

    res.json({
      success: true,
      message: 'Guide emailed successfully',
      guideId: guide.id,
      to: user.email
    });
  } catch (error) {
    console.error('❌ Email sending error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// PUT /api/guides/:id/favorite - Toggle guide favorite status
router.put('/:id/favorite', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    console.log(`⭐ Favorite toggle - Guide ID: ${id}, User ID: ${userId}`);

    let guide = null;
    if (hasGuideModel) {
      guide = await Guide.findOne({
        where: { id, userId },
        attributes: ['id', 'guideId', 'characterName', 'productionTitle', 'isFavorite']
      });
    } else {
      if (supabaseUnavailable(res)) return;
      const { data } = await executeSupabase((client) =>
        client
          .from(SUPABASE_GUIDES_TABLE)
          .select('id,guideId,characterName,productionTitle,isFavorite')
          .eq('id', id)
          .eq('userId', userId)
          .maybeSingle()
      );
      guide = normalizeGuideRow(data);
    }

    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    // Toggle favorite status
    const currentFavorite =
      typeof guide.isFavorite === 'boolean'
        ? guide.isFavorite
        : Boolean(guide.get?.('isFavorite'));
    const newFavoriteStatus = !currentFavorite;

    if (hasGuideModel && guide.update) {
      await guide.update({ isFavorite: newFavoriteStatus });
    } else {
      await executeSupabase((client) =>
        client
          .from(SUPABASE_GUIDES_TABLE)
          .update({ isFavorite: newFavoriteStatus })
          .eq('id', id)
          .eq('userId', userId)
      );
    }

    console.log(`⭐ Guide ${newFavoriteStatus ? 'favorited' : 'unfavorited'}: ${guide.characterName} in ${guide.productionTitle}`);

    res.json({
      success: true,
      message: `Guide ${newFavoriteStatus ? 'added to' : 'removed from'} favorites`,
      guide: {
        id: guide.id,
        guideId: guide.guideId,
        characterName: guide.characterName,
        productionTitle: guide.productionTitle,
        isFavorite: newFavoriteStatus
      }
    });

  } catch (error) {
    console.error('❌ Favorite toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite status' });
  }
});

// GET /api/guides/favorites - Get user's favorite guides
router.get('/favorites', auth, async (req, res) => {
  try {
    const userId = req.userId;

    console.log(`⭐ Fetching favorites - User ID: ${userId}`);

    if (hasGuideModel) {
      const guides = await Guide.findAll({
        where: { userId, isFavorite: true },
        order: [['createdAt', 'DESC']],
        attributes: [
          'id',
          'guideId',
          'characterName',
          'productionTitle',
          'productionType',
          'roleSize',
          'genre',
          'createdAt',
          'viewCount',
          'childGuideRequested',
          'childGuideCompleted',
          'childGuideHtml',
          'isFavorite',
        ],
      });

      console.log(`⭐ Found ${guides.length} favorite guides`);

      res.json({
        success: true,
        guides,
        total: guides.length,
      });
      return;
    }

    if (supabaseUnavailable(res)) return;

    const { data } = await executeSupabase((client) =>
      client
        .from(SUPABASE_GUIDES_TABLE)
        .select(GUIDE_SUMMARY_FIELDS)
        .eq('userId', userId)
        .eq('isFavorite', true)
        .order('createdAt', { ascending: false })
    );

    const guides = (data || []).map(normalizeGuideRow);
    console.log(`⭐ Found ${guides.length} favorite guides (Supabase fallback)`);

    res.json({
      success: true,
      guides,
      total: guides.length,
    });
  } catch (error) {
    console.error('❌ Error fetching favorite guides:', error);
    res.status(500).json({ error: 'Failed to fetch favorite guides' });
  }
});

module.exports = router;
