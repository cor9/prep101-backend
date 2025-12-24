const express = require("express");
const { Op, fn, col, literal } = require("sequelize");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Guide = require("../models/Guide");
const PromoCode = require("../models/PromoCode");
const PromoCodeRedemption = require("../models/PromoCodeRedemption");
const { sequelize } = require("../database/connection");
const {
  isSupabaseAdminConfigured,
  runAdminQuery,
  tables: supabaseTables,
} = require("../lib/supabaseAdmin");

const router = express.Router();

// Check if database models are available
const hasDatabase = User !== null && Guide !== null;
const hasSupabaseFallback = isSupabaseAdminConfigured();

// Log database status on module load
console.log("🔍 Admin routes - Database status:", {
  hasDatabase,
  hasSupabaseFallback,
  UserModel: User ? "loaded" : "null",
  GuideModel: Guide ? "loaded" : "null",
  sequelize: sequelize ? "available" : "null",
});

// ============================================================================
// ADMIN MIDDLEWARE
// ============================================================================

/**
 * Require that the current user is an admin.
 * Primary check: beta admin flags from the database.
 * Safety net: allow the known owner email to access admin even if flags ever drift.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = req.user;

    // Debug logging to help diagnose admin access issues
    console.log("🔍 Admin check:", {
      userId: user?.id,
      email: user?.email,
      isBetaTester: user?.isBetaTester,
      betaAccessLevel: user?.betaAccessLevel,
      isOwnerEmail: user?.email === "corey@childactor101.com",
    });

    const isBetaAdmin =
      user && user.isBetaTester && user.betaAccessLevel === "admin";
    const ownerEmail = process.env.OWNER_EMAIL || "corey@childactor101.com";
    const isOwnerEmail = user && user.email === ownerEmail;

    if (!isBetaAdmin && !isOwnerEmail) {
      console.log("❌ Admin access denied:", {
        email: user?.email,
        isBetaTester: user?.isBetaTester,
        betaAccessLevel: user?.betaAccessLevel,
        isOwnerEmail,
      });
      return res.status(403).json({ message: "Admin access required" });
    }

    console.log("✅ Admin access granted:", user?.email);
    next();
  } catch (error) {
    console.error("Admin check failed:", error);
    res.status(500).json({ message: "Authorization check failed" });
  }
};

// ============================================================================
// DASHBOARD OVERVIEW
// ============================================================================

/**
 * GET /api/admin/dashboard
 * Comprehensive dashboard overview with all key metrics
 */
router.get("/dashboard", auth, requireAdmin, async (req, res) => {
  try {
    // Check if database is available
    if (!hasDatabase) {
      if (!hasSupabaseFallback) {
        return res.status(503).json({
          success: false,
          message:
            "Database service unavailable. Please configure DATABASE_URL or Supabase credentials.",
          error: "No database connection available",
        });
      }
      // TODO: Implement Supabase fallback for dashboard stats
      return res.status(503).json({
        success: false,
        message:
          "Database service unavailable. Supabase fallback for dashboard stats not yet implemented.",
        error: "Database connection required for admin dashboard",
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Parallel fetch all stats
    const [
      totalUsers,
      totalGuides,
      usersToday,
      usersThisWeek,
      usersThisMonth,
      guidesToday,
      guidesThisWeek,
      guidesThisMonth,
      subscriptionBreakdown,
      activeSubscriptions,
      betaTesters,
      promoCodesCount,
      redemptionsCount,
      recentUsers,
      recentGuides,
    ] = await Promise.all([
      // Total counts
      User.count(),
      Guide.count(),

      // Users by time period
      User.count({ where: { createdAt: { [Op.gte]: today } } }),
      User.count({ where: { createdAt: { [Op.gte]: thisWeek } } }),
      User.count({ where: { createdAt: { [Op.gte]: thisMonth } } }),

      // Guides by time period
      Guide.count({ where: { createdAt: { [Op.gte]: today } } }),
      Guide.count({ where: { createdAt: { [Op.gte]: thisWeek } } }),
      Guide.count({ where: { createdAt: { [Op.gte]: thisMonth } } }),

      // Subscription breakdown
      User.findAll({
        attributes: ["subscription", [fn("COUNT", col("id")), "count"]],
        group: ["subscription"],
      }),

      // Active paid subscriptions
      User.count({
        where: {
          subscription: { [Op.ne]: "free" },
          subscriptionStatus: "active",
        },
      }),

      // Beta testers count
      User.count({ where: { isBetaTester: true } }),

      // Promo codes
      PromoCode ? PromoCode.count() : 0,
      PromoCodeRedemption ? PromoCodeRedemption.count() : 0,

      // Recent users (last 5)
      User.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "email", "name", "subscription", "createdAt"],
      }),

      // Recent guides (last 5)
      Guide.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: [
          "id",
          "guideId",
          "characterName",
          "productionTitle",
          "createdAt",
        ],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["email", "name"],
          },
        ],
      }),
    ]);

    // Calculate growth rates
    const lastMonthUsers = await User.count({
      where: {
        createdAt: {
          [Op.gte]: lastMonth,
          [Op.lt]: thisMonth,
        },
      },
    });

    const userGrowthRate =
      lastMonthUsers > 0
        ? (((usersThisMonth - lastMonthUsers) / lastMonthUsers) * 100).toFixed(
            1
          )
        : 100;

    // Guide usage stats
    const guideStats = await User.findAll({
      attributes: [
        [fn("SUM", col("guidesUsed")), "totalGuidesUsed"],
        [fn("SUM", col("guidesLimit")), "totalGuidesLimit"],
        [fn("AVG", col("guidesUsed")), "avgGuidesUsed"],
      ],
    });

    const usageData = guideStats[0]?.get({ plain: true }) || {};

    res.json({
      success: true,
      dashboard: {
        overview: {
          totalUsers,
          totalGuides,
          activeSubscriptions,
          betaTesters,
          promoCodesCount,
          redemptionsCount,
        },
        users: {
          total: totalUsers,
          today: usersToday,
          thisWeek: usersThisWeek,
          thisMonth: usersThisMonth,
          growthRate: parseFloat(userGrowthRate),
        },
        guides: {
          total: totalGuides,
          today: guidesToday,
          thisWeek: guidesThisWeek,
          thisMonth: guidesThisMonth,
          totalUsed: parseInt(usageData.totalGuidesUsed) || 0,
          avgPerUser: parseFloat(usageData.avgGuidesUsed || 0).toFixed(2),
        },
        subscriptions: subscriptionBreakdown.map((row) => ({
          type: row.subscription,
          count: Number(row.get("count")),
        })),
        recentUsers: recentUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          subscription: u.subscription,
          createdAt: u.createdAt,
        })),
        recentGuides: recentGuides.map((g) => ({
          id: g.id,
          guideId: g.guideId,
          characterName: g.characterName,
          productionTitle: g.productionTitle,
          createdAt: g.createdAt,
          user: g.user ? { email: g.user.email, name: g.user.name } : null,
        })),
      },
    });
  } catch (error) {
    console.error("Admin dashboard fetch error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

/**
 * GET /api/admin/stats
 * High-level platform stats (legacy endpoint, kept for compatibility)
 */
router.get("/stats", auth, requireAdmin, async (req, res) => {
  try {
    if (!hasDatabase) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
        error: "No database connection available",
      });
    }

    const [totalUsers, totalGuides] = await Promise.all([
      User.count(),
      Guide.count(),
    ]);

    const subscriptions = await User.findAll({
      attributes: ["subscription", [fn("COUNT", col("id")), "count"]],
      group: ["subscription"],
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalGuides,
        subscriptions: subscriptions.map((row) => ({
          subscription: row.subscription,
          count: Number(row.get("count")),
        })),
      },
    });
  } catch (error) {
    console.error("Admin stats fetch error:", error);
    res.status(500).json({ message: "Failed to fetch admin stats" });
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/users
 * List all users with pagination, search, filtering, and sorting
 */
router.get("/users", auth, requireAdmin, async (req, res) => {
  try {
    if (!hasDatabase) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
        error: "No database connection available",
      });
    }

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "25", 10))
    );
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const subscription = req.query.subscription;
    const betaOnly = req.query.betaOnly === "true";
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

    const where = {};

    // Search filter
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Subscription filter
    if (subscription && ["free", "basic", "premium"].includes(subscription)) {
      where.subscription = subscription;
    }

    // Beta tester filter
    if (betaOnly) {
      where.isBetaTester = true;
    }

    // Validate sort field
    const allowedSortFields = [
      "createdAt",
      "email",
      "name",
      "subscription",
      "guidesUsed",
      "guidesLimit",
    ];
    const orderField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";

    const { count, rows } = await User.findAndCountAll({
      where,
      order: [[orderField, sortOrder]],
      offset,
      limit,
      attributes: [
        "id",
        "email",
        "name",
        "subscription",
        "subscriptionStatus",
        "stripeCustomerId",
        "stripeSubscriptionId",
        "guidesUsed",
        "guidesLimit",
        "isBetaTester",
        "betaAccessLevel",
        "betaStatus",
        "createdAt",
        "updatedAt",
      ],
    });

    // Get guide stats for these users
    const userIds = rows.map((u) => u.id);
    let guideStatsByUser = {};

    if (userIds.length > 0) {
      const guideStats = await Guide.findAll({
        attributes: [
          "userId",
          [fn("COUNT", col("id")), "guidesCount"],
          [fn("MAX", col("createdAt")), "lastGuideAt"],
        ],
        where: { userId: { [Op.in]: userIds } },
        group: ["userId"],
      });

      guideStatsByUser = guideStats.reduce((acc, row) => {
        const plain = row.get({ plain: true });
        acc[plain.userId] = {
          guidesCount: Number(plain.guidesCount || 0),
          lastGuideAt: plain.lastGuideAt,
        };
        return acc;
      }, {});
    }

    const users = rows.map((u) => {
      const stats = guideStatsByUser[u.id] || {
        guidesCount: 0,
        lastGuideAt: null,
      };
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        subscription: u.subscription,
        subscriptionStatus: u.subscriptionStatus,
        stripeCustomerId: u.stripeCustomerId,
        stripeSubscriptionId: u.stripeSubscriptionId,
        guidesUsed: u.guidesUsed,
        guidesLimit: u.guidesLimit,
        guidesCount: stats.guidesCount,
        lastGuideAt: stats.lastGuideAt,
        isBetaTester: u.isBetaTester,
        betaAccessLevel: u.betaAccessLevel,
        betaStatus: u.betaStatus,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });

    res.json({
      success: true,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      users,
    });
  } catch (error) {
    console.error("Admin users fetch error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/**
 * GET /api/admin/users/:id
 * Get detailed information about a specific user
 */
router.get("/users/:id", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's guides
    const guides = await Guide.findAll({
      where: { userId: id },
      order: [["createdAt", "DESC"]],
      limit: 50,
      attributes: [
        "id",
        "guideId",
        "characterName",
        "productionTitle",
        "productionType",
        "genre",
        "isPublic",
        "viewCount",
        "createdAt",
      ],
    });

    // Get user's promo code redemptions
    let redemptions = [];
    if (PromoCodeRedemption) {
      redemptions = await PromoCodeRedemption.findAll({
        where: { userId: id },
        include: [
          {
            model: PromoCode,
            as: "promoCode",
            attributes: ["code", "type", "description"],
          },
        ],
        order: [["redeemedAt", "DESC"]],
      });
    }

    // Get Stripe billing info if available
    let billingInfo = null;
    if (user.stripeCustomerId) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const [customer, invoices, subscriptions] = await Promise.all([
          stripe.customers.retrieve(user.stripeCustomerId),
          stripe.invoices.list({ customer: user.stripeCustomerId, limit: 10 }),
          stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            limit: 5,
          }),
        ]);

        billingInfo = {
          customer: {
            id: customer.id,
            email: customer.email,
            created: new Date(customer.created * 1000),
            balance: customer.balance,
          },
          invoices: invoices.data.map((inv) => ({
            id: inv.id,
            amount: inv.amount_paid / 100,
            currency: inv.currency.toUpperCase(),
            status: inv.status,
            date: new Date(inv.created * 1000),
            pdfUrl: inv.invoice_pdf,
          })),
          subscriptions: subscriptions.data.map((sub) => ({
            id: sub.id,
            status: sub.status,
            plan: sub.items.data[0]?.price?.nickname || "Unknown",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          })),
        };
      } catch (stripeError) {
        console.error("Error fetching Stripe data:", stripeError.message);
      }
    }

    res.json({
      success: true,
      user: {
        ...user.get({ plain: true }),
        password: undefined, // Remove password from response
      },
      guides: guides.map((g) => g.get({ plain: true })),
      redemptions: redemptions.map((r) => ({
        id: r.id,
        code: r.promoCode?.code,
        type: r.promoCode?.type,
        description: r.promoCode?.description,
        guidesGranted: r.guidesGranted,
        discountPercent: r.discountPercent,
        redeemedAt: r.redeemedAt,
      })),
      billing: billingInfo,
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    res.status(500).json({ message: "Failed to fetch user details" });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update a user's information
 */
router.put("/users/:id", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      subscription,
      subscriptionStatus,
      guidesLimit,
      guidesUsed,
      isBetaTester,
      betaAccessLevel,
      betaStatus,
    } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (
      subscription !== undefined &&
      ["free", "basic", "premium"].includes(subscription)
    ) {
      updates.subscription = subscription;
    }
    if (subscriptionStatus !== undefined)
      updates.subscriptionStatus = subscriptionStatus;
    if (typeof guidesLimit === "number" && guidesLimit >= 0)
      updates.guidesLimit = guidesLimit;
    if (typeof guidesUsed === "number" && guidesUsed >= 0)
      updates.guidesUsed = guidesUsed;
    if (typeof isBetaTester === "boolean") updates.isBetaTester = isBetaTester;
    if (
      betaAccessLevel !== undefined &&
      ["none", "early", "premium", "admin"].includes(betaAccessLevel)
    ) {
      updates.betaAccessLevel = betaAccessLevel;
    }
    if (
      betaStatus !== undefined &&
      ["invited", "active", "completed", "expired"].includes(betaStatus)
    ) {
      updates.betaStatus = betaStatus;
    }

    await user.update(updates);

    res.json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        subscriptionStatus: user.subscriptionStatus,
        guidesUsed: user.guidesUsed,
        guidesLimit: user.guidesLimit,
        isBetaTester: user.isBetaTester,
        betaAccessLevel: user.betaAccessLevel,
        betaStatus: user.betaStatus,
      },
    });
  } catch (error) {
    console.error("Admin user update error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

/**
 * PUT /api/admin/users/:id/guides
 * Adjust a user's guide limits/usage (legacy endpoint, kept for compatibility)
 */
router.put("/users/:id/guides", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { guidesLimit, guidesUsed, addGuides } = req.body || {};

    if (
      typeof guidesLimit === "undefined" &&
      typeof guidesUsed === "undefined" &&
      typeof addGuides === "undefined"
    ) {
      return res
        .status(400)
        .json({ message: "No guide fields provided to update" });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updates = {};

    if (
      typeof guidesLimit === "number" &&
      Number.isInteger(guidesLimit) &&
      guidesLimit >= 0
    ) {
      updates.guidesLimit = guidesLimit;
    }

    if (
      typeof guidesUsed === "number" &&
      Number.isInteger(guidesUsed) &&
      guidesUsed >= 0
    ) {
      updates.guidesUsed = guidesUsed;
    }

    if (
      typeof addGuides === "number" &&
      Number.isInteger(addGuides) &&
      addGuides !== 0
    ) {
      updates.guidesLimit =
        (updates.guidesLimit ?? user.guidesLimit) + addGuides;
    }

    await user.update(updates);

    res.json({
      success: true,
      message: "Guide limits updated",
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription,
        guidesUsed: user.guidesUsed,
        guidesLimit: user.guidesLimit,
      },
    });
  } catch (error) {
    console.error("Admin guides update error:", error);
    res.status(500).json({ message: "Failed to update guide limits" });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user and optionally their guides
 */
router.delete("/users/:id", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteGuides } = req.query;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deleting yourself
    if (user.id === req.userId) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }

    // Delete guides if requested
    if (deleteGuides === "true") {
      await Guide.destroy({ where: { userId: id } });
    }

    // Delete promo code redemptions
    if (PromoCodeRedemption) {
      await PromoCodeRedemption.destroy({ where: { userId: id } });
    }

    // Delete user
    await user.destroy();

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Admin user delete error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// ============================================================================
// GUIDE MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/guides
 * List all guides with pagination, search, and filtering
 */
router.get("/guides", auth, requireAdmin, async (req, res) => {
  try {
    if (!hasDatabase) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
        error: "No database connection available",
      });
    }

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "25", 10))
    );
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const productionType = req.query.productionType;
    const genre = req.query.genre;
    const isPublic = req.query.isPublic;
    const userId = req.query.userId;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

    const where = {};

    // Search filter
    if (search) {
      where[Op.or] = [
        { characterName: { [Op.iLike]: `%${search}%` } },
        { productionTitle: { [Op.iLike]: `%${search}%` } },
        { guideId: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Filters
    if (productionType) where.productionType = productionType;
    if (genre) where.genre = genre;
    if (isPublic !== undefined) where.isPublic = isPublic === "true";
    if (userId) where.userId = userId;

    // Validate sort field
    const allowedSortFields = [
      "createdAt",
      "characterName",
      "productionTitle",
      "viewCount",
    ];
    const orderField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";

    const { count, rows } = await Guide.findAndCountAll({
      where,
      order: [[orderField, sortOrder]],
      offset,
      limit,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "name"],
        },
      ],
      attributes: [
        "id",
        "guideId",
        "characterName",
        "productionTitle",
        "productionType",
        "productionTone",
        "roleSize",
        "genre",
        "isPublic",
        "viewCount",
        "isFavorite",
        "childGuideRequested",
        "childGuideCompleted",
        "createdAt",
        "updatedAt",
      ],
    });

    res.json({
      success: true,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      guides: rows.map((g) => ({
        ...g.get({ plain: true }),
        user: g.user
          ? { id: g.user.id, email: g.user.email, name: g.user.name }
          : null,
      })),
    });
  } catch (error) {
    console.error("Admin guides fetch error:", error);
    res.status(500).json({ message: "Failed to fetch guides" });
  }
});

/**
 * GET /api/admin/guides/:id
 * Get full details of a specific guide
 */
router.get("/guides/:id", auth, requireAdmin, async (req, res) => {
  try {
    if (!hasDatabase) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
        error: "No database connection available",
      });
    }

    const { id } = req.params;

    const guide = await Guide.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "name", "subscription"],
        },
      ],
    });

    if (!guide) {
      return res.status(404).json({ message: "Guide not found" });
    }

    res.json({
      success: true,
      guide: guide.get({ plain: true }),
    });
  } catch (error) {
    console.error("Admin guide detail error:", error);
    res.status(500).json({ message: "Failed to fetch guide details" });
  }
});

/**
 * DELETE /api/admin/guides/:id
 * Delete a specific guide
 */
router.delete("/guides/:id", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const guide = await Guide.findByPk(id);
    if (!guide) {
      return res.status(404).json({ message: "Guide not found" });
    }

    await guide.destroy();

    res.json({
      success: true,
      message: "Guide deleted successfully",
    });
  } catch (error) {
    console.error("Admin guide delete error:", error);
    res.status(500).json({ message: "Failed to delete guide" });
  }
});

/**
 * GET /api/admin/guides/analytics
 * Get guide analytics and statistics
 */
router.get("/guides/analytics", auth, requireAdmin, async (req, res) => {
  try {
    if (!hasDatabase) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
        error: "No database connection available",
      });
    }

    // Get production type breakdown
    const byProductionType = await Guide.findAll({
      attributes: ["productionType", [fn("COUNT", col("id")), "count"]],
      group: ["productionType"],
      order: [[literal("count"), "DESC"]],
    });

    // Get genre breakdown
    const byGenre = await Guide.findAll({
      attributes: ["genre", [fn("COUNT", col("id")), "count"]],
      group: ["genre"],
      order: [[literal("count"), "DESC"]],
    });

    // Get role size breakdown
    const byRoleSize = await Guide.findAll({
      attributes: ["roleSize", [fn("COUNT", col("id")), "count"]],
      group: ["roleSize"],
      order: [[literal("count"), "DESC"]],
    });

    // Public vs private guides
    const publicPrivate = await Guide.findAll({
      attributes: ["isPublic", [fn("COUNT", col("id")), "count"]],
      group: ["isPublic"],
    });

    // Child guides stats
    const childGuideStats = await Guide.findAll({
      attributes: [
        [
          fn(
            "SUM",
            literal('CASE WHEN "childGuideRequested" = true THEN 1 ELSE 0 END')
          ),
          "requested",
        ],
        [
          fn(
            "SUM",
            literal('CASE WHEN "childGuideCompleted" = true THEN 1 ELSE 0 END')
          ),
          "completed",
        ],
      ],
    });

    // Top viewed guides
    const topViewed = await Guide.findAll({
      where: { viewCount: { [Op.gt]: 0 } },
      order: [["viewCount", "DESC"]],
      limit: 10,
      attributes: [
        "id",
        "guideId",
        "characterName",
        "productionTitle",
        "viewCount",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["email", "name"],
        },
      ],
    });

    // Guides created over time (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyGuides = await Guide.findAll({
      attributes: [
        [fn("DATE", col("createdAt")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
      group: [fn("DATE", col("createdAt"))],
      order: [[fn("DATE", col("createdAt")), "ASC"]],
    });

    const childStats = childGuideStats[0]?.get({ plain: true }) || {};

    res.json({
      success: true,
      analytics: {
        byProductionType: byProductionType.map((r) => ({
          type: r.productionType,
          count: Number(r.get("count")),
        })),
        byGenre: byGenre.map((r) => ({
          genre: r.genre,
          count: Number(r.get("count")),
        })),
        byRoleSize: byRoleSize.map((r) => ({
          roleSize: r.roleSize,
          count: Number(r.get("count")),
        })),
        visibility: {
          public: publicPrivate.find((r) => r.isPublic)?.get("count") || 0,
          private: publicPrivate.find((r) => !r.isPublic)?.get("count") || 0,
        },
        childGuides: {
          requested: parseInt(childStats.requested) || 0,
          completed: parseInt(childStats.completed) || 0,
        },
        topViewed: topViewed.map((g) => ({
          id: g.id,
          guideId: g.guideId,
          characterName: g.characterName,
          productionTitle: g.productionTitle,
          viewCount: g.viewCount,
          user: g.user ? { email: g.user.email, name: g.user.name } : null,
        })),
        dailyCreation: dailyGuides.map((r) => ({
          date: r.get("date"),
          count: Number(r.get("count")),
        })),
      },
    });
  } catch (error) {
    console.error("Admin guide analytics error:", error);
    res.status(500).json({ message: "Failed to fetch guide analytics" });
  }
});

// ============================================================================
// REVENUE & PAYMENTS
// ============================================================================

/**
 * GET /api/admin/revenue
 * Get revenue analytics from Stripe
 */
router.get("/revenue", auth, requireAdmin, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn("[ADMIN_REVENUE] Stripe not configured");
      return res.json({
        success: true,
        revenue: {
          balance: { available: 0, pending: 0, currency: "USD" },
          thisMonth: 0,
          lastMonth: 0,
          thisYear: 0,
          mrr: 0,
          growth: 0,
          subscriptions: { active: 0, canceled: 0, trialing: 0, total: 0 },
          recentTransactions: [],
        },
        message: "Stripe not configured",
      });
    }

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const now = new Date();
    const thisMonth = Math.floor(
      new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
    );
    const lastMonth = Math.floor(
      new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000
    );
    const thisYear = Math.floor(
      new Date(now.getFullYear(), 0, 1).getTime() / 1000
    );

    // Get balance with error handling
    let balance = { available: [], pending: [] };
    try {
      balance = await stripe.balance.retrieve();
    } catch (balanceError) {
      console.warn("[ADMIN_REVENUE] Error fetching balance:", balanceError.message);
      // Continue with empty balance
    }

    // Allowed product IDs for revenue calculation
    const allowedProductIds = [
      "prod_SwSC2lUrIwBKP6",
      "prod_SwS55c4KaSZNmM",
      "prod_SwS0gu1NNU9g2S",
      "prod_SwRoKtto1AE7SM",
      "prod_SwRDOUfUg85u7Y",
      "prod_TUIKgvjCsJN3Wh",
      "prod_TUIHQcnJlcURJm",
    ];

    // Get all subscriptions and filter by product
    let allSubscriptions = { data: [] };
    try {
      allSubscriptions = await stripe.subscriptions.list({
        limit: 100,
        status: "all",
      });
    } catch (subError) {
      console.error("[ADMIN_REVENUE] Error fetching subscriptions:", subError.message);
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    // Filter subscriptions to only allowed products
    // We need to check the product ID from the price
    const filteredSubscriptions = [];
    for (const sub of allSubscriptions.data) {
      try {
        const item = sub.items.data[0];
        if (!item?.price?.product) continue;
        
        // Get product ID - it might be a string or we need to expand it
        let productId = item.price.product;
        if (typeof productId === "string") {
          // If it's a string ID, check if it's in our allowed list
          if (allowedProductIds.includes(productId)) {
            filteredSubscriptions.push(sub);
          }
        } else {
          // If it's already expanded, use the id property
          if (productId?.id && allowedProductIds.includes(productId.id)) {
            filteredSubscriptions.push(sub);
          }
        }
      } catch (err) {
        console.warn(`[ADMIN_REVENUE] Error processing subscription ${sub.id}:`, err.message);
        // Continue to next subscription
      }
    }

    // Get invoices for filtered subscriptions to calculate revenue
    const subscriptionIds = filteredSubscriptions.map((s) => s.id);
    const allInvoices = [];

    // Fetch invoices with rate limiting and error handling
    for (const subId of subscriptionIds) {
      try {
        const invoices = await stripe.invoices.list({
          subscription: subId,
          limit: 100,
        });
        if (invoices && invoices.data) {
          allInvoices.push(...invoices.data);
        }
      } catch (err) {
        console.warn(
          `[ADMIN_REVENUE] Error fetching invoices for subscription ${subId}:`,
          err.message
        );
        // Continue with other subscriptions
      }
    }

    // Calculate revenue from invoices (only from allowed products)
    const thisMonthRevenue = allInvoices
      .filter((inv) => {
        const invDate = new Date(inv.created * 1000);
        const invTimestamp = Math.floor(invDate.getTime() / 1000);
        return invTimestamp >= thisMonth && inv.status === "paid";
      })
      .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);

    const lastMonthRevenue = allInvoices
      .filter((inv) => {
        const invDate = new Date(inv.created * 1000);
        const invTimestamp = Math.floor(invDate.getTime() / 1000);
        return (
          invTimestamp >= lastMonth &&
          invTimestamp < thisMonth &&
          inv.status === "paid"
        );
      })
      .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);

    const thisYearRevenue = allInvoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);

    const activeSubscriptions = filteredSubscriptions.filter(
      (s) => s.status === "active"
    ).length;
    const canceledSubscriptions = filteredSubscriptions.filter(
      (s) => s.status === "canceled"
    ).length;
    const trialingSubscriptions = filteredSubscriptions.filter(
      (s) => s.status === "trialing"
    ).length;

    // Calculate MRR (Monthly Recurring Revenue) - only from allowed products
    const mrr = filteredSubscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => {
        const item = s.items.data[0];
        if (item?.price?.recurring?.interval === "month") {
          return sum + (item.price.unit_amount || 0);
        } else if (item?.price?.recurring?.interval === "year") {
          return sum + (item.price.unit_amount || 0) / 12;
        }
        return sum;
      }, 0);

    // Recent transactions from invoices (only from allowed products)
    const recentTransactions = allInvoices
      .filter((inv) => inv.status === "paid")
      .sort((a, b) => b.created - a.created)
      .slice(0, 20)
      .map((inv) => ({
        id: inv.id,
        amount: (inv.amount_paid || 0) / 100,
        currency: inv.currency.toUpperCase(),
        status: inv.status === "paid" ? "succeeded" : inv.status,
        date: new Date(inv.created * 1000),
        description:
          inv.description || `Invoice for ${inv.customer_email || "customer"}`,
        customerEmail: inv.customer_email,
      }));

    // Revenue growth
    const revenueGrowth =
      lastMonthRevenue > 0
        ? (
            ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) *
            100
          ).toFixed(1)
        : thisMonthRevenue > 0
        ? 100
        : 0;

    // Safely calculate balance totals
    const availableBalance = Array.isArray(balance.available)
      ? balance.available.reduce((sum, b) => sum + (b.amount || 0), 0) / 100
      : 0;
    const pendingBalance = Array.isArray(balance.pending)
      ? balance.pending.reduce((sum, b) => sum + (b.amount || 0), 0) / 100
      : 0;

    res.json({
      success: true,
      revenue: {
        balance: {
          available: availableBalance,
          pending: pendingBalance,
          currency: "USD",
        },
        thisMonth: thisMonthRevenue / 100,
        lastMonth: lastMonthRevenue / 100,
        thisYear: thisYearRevenue / 100,
        mrr: mrr / 100,
        growth: parseFloat(revenueGrowth),
        subscriptions: {
          active: activeSubscriptions,
          canceled: canceledSubscriptions,
          trialing: trialingSubscriptions,
          total: filteredSubscriptions.length,
        },
        recentTransactions,
      },
    });
  } catch (error) {
    console.error("[ADMIN_REVENUE] ERROR:", error.message);
    console.error("[ADMIN_REVENUE] Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenue data",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/subscriptions
 * Get all subscriptions with details
 */
router.get("/subscriptions", auth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "25", 10))
    );
    const status = req.query.status; // active, canceled, past_due, etc.

    // Get users with subscriptions
    const where = {
      stripeSubscriptionId: { [Op.ne]: null },
    };

    if (status) {
      where.subscriptionStatus = status;
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      offset: (page - 1) * limit,
      limit,
      attributes: [
        "id",
        "email",
        "name",
        "subscription",
        "subscriptionStatus",
        "stripeCustomerId",
        "stripeSubscriptionId",
        "stripePriceId",
        "currentPeriodStart",
        "currentPeriodEnd",
        "createdAt",
      ],
    });

    res.json({
      success: true,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      subscriptions: rows.map((u) => ({
        userId: u.id,
        email: u.email,
        name: u.name,
        plan: u.subscription,
        status: u.subscriptionStatus,
        stripeCustomerId: u.stripeCustomerId,
        stripeSubscriptionId: u.stripeSubscriptionId,
        currentPeriodStart: u.currentPeriodStart,
        currentPeriodEnd: u.currentPeriodEnd,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin subscriptions fetch error:", error);
    res.status(500).json({ message: "Failed to fetch subscriptions" });
  }
});

// ============================================================================
// PROMO CODES
// ============================================================================

/**
 * GET /api/admin/promo-codes
 * List all promo codes with analytics
 */
router.get("/promo-codes", auth, requireAdmin, async (req, res) => {
  try {
    if (!PromoCode) {
      console.warn("[ADMIN_PROMO_CODES] PromoCode model not available");
      return res.json({
        success: true,
        promoCodes: [],
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        message: "PromoCode model not available",
      });
    }

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "25", 10))
    );
    const offset = (page - 1) * limit;
    const activeOnly = req.query.activeOnly === "true";

    const where = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const { count, rows } = await PromoCode.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      offset,
      limit,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["email", "name"],
        },
      ],
    });

    res.json({
      success: true,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      promoCodes: rows.map((pc) => ({
        id: pc.id,
        code: pc.code,
        description: pc.description,
        type: pc.type,
        guidesGranted: pc.guidesGranted,
        discountPercent: pc.discountPercent,
        maxRedemptions: pc.maxRedemptions,
        currentRedemptions: pc.currentRedemptions,
        maxRedemptionsPerUser: pc.maxRedemptionsPerUser,
        isActive: pc.isActive,
        startsAt: pc.startsAt,
        expiresAt: pc.expiresAt,
        createdBy: pc.creator
          ? { email: pc.creator.email, name: pc.creator.name }
          : null,
        notes: pc.notes,
        createdAt: pc.createdAt,
      })),
    });
  } catch (error) {
    console.error("[ADMIN_PROMO_CODES] ERROR:", error.message);
    console.error("[ADMIN_PROMO_CODES] Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promo codes",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/promo-codes/analytics
 * Get promo code analytics
 */
router.get("/promo-codes/analytics", auth, requireAdmin, async (req, res) => {
  try {
    if (!PromoCode || !PromoCodeRedemption) {
      console.warn("[ADMIN_PROMO_ANALYTICS] Models not available");
      return res.json({
        success: true,
        analytics: {
          totalCodes: 0,
          activeCodes: 0,
          totalRedemptions: 0,
          totalGuidesGranted: 0,
          topCodes: [],
          recentRedemptions: [],
        },
      });
    }

    // Get basic counts first
    const [totalCodes, activeCodes, totalRedemptions] = await Promise.all([
      PromoCode.count(),
      PromoCode.count({ where: { isActive: true } }),
      PromoCodeRedemption.count(),
    ]);

    // Get guides granted sum (handle null)
    let guidesGrantedSum = 0;
    try {
      const sumResult = await PromoCodeRedemption.sum("guidesGranted");
      guidesGrantedSum = sumResult || 0;
    } catch (sumError) {
      console.warn(
        "[ADMIN_PROMO_ANALYTICS] Error summing guidesGranted:",
        sumError.message
      );
    }

    // Get redemptions by code (simplified query)
    let redemptionsByCode = [];
    try {
      const allRedemptions = await PromoCodeRedemption.findAll({
        attributes: ["promoCodeId", "guidesGranted"],
        include: [
          {
            model: PromoCode,
            as: "promoCode",
            attributes: ["code", "description"],
            required: false,
          },
        ],
      });

      // Group manually
      const grouped = {};
      allRedemptions.forEach((r) => {
        const codeId = r.promoCodeId;
        if (!grouped[codeId]) {
          grouped[codeId] = {
            promoCode: r.promoCode || { code: "Unknown", description: null },
            count: 0,
            totalGuides: 0,
          };
        }
        grouped[codeId].count++;
        grouped[codeId].totalGuides += r.guidesGranted || 0;
      });

      redemptionsByCode = Object.values(grouped)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (groupError) {
      console.error(
        "[ADMIN_PROMO_ANALYTICS] Error grouping redemptions:",
        groupError.message
      );
      console.error("[ADMIN_PROMO_ANALYTICS] Stack:", groupError.stack);
    }

    // Get recent redemptions
    let recentRedemptions = [];
    try {
      recentRedemptions = await PromoCodeRedemption.findAll({
        order: [["redeemedAt", "DESC"]],
        limit: 20,
        include: [
          {
            model: PromoCode,
            as: "promoCode",
            attributes: ["code", "type"],
            required: false,
          },
          {
            model: User,
            as: "user",
            attributes: ["email", "name"],
            required: false,
          },
        ],
      });
    } catch (recentError) {
      console.error(
        "[ADMIN_PROMO_ANALYTICS] Error fetching recent redemptions:",
        recentError.message
      );
      console.error("[ADMIN_PROMO_ANALYTICS] Stack:", recentError.stack);
    }

    res.json({
      success: true,
      analytics: {
        totalCodes,
        activeCodes,
        totalRedemptions,
        totalGuidesGranted: guidesGrantedSum || 0,
        topCodes: redemptionsByCode.map((r) => ({
          code: r.promoCode?.code,
          description: r.promoCode?.description,
          redemptions: r.count || 0,
          guidesGranted: r.totalGuides || 0,
        })),
        recentRedemptions: recentRedemptions.map((r) => ({
          id: r.id,
          code: r.promoCode?.code,
          type: r.promoCode?.type,
          user: r.user ? { email: r.user.email, name: r.user.name } : null,
          guidesGranted: r.guidesGranted,
          redeemedAt: r.redeemedAt,
        })),
      },
    });
  } catch (error) {
    console.error("[ADMIN_PROMO_ANALYTICS] ERROR:", error.message);
    console.error("[ADMIN_PROMO_ANALYTICS] Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promo analytics",
      error: error.message,
    });
  }
});

// ============================================================================
// ACTIVITY & GROWTH
// ============================================================================

/**
 * GET /api/admin/activity
 * Get platform activity over time
 */
router.get("/activity", auth, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(
      90,
      Math.max(7, parseInt(req.query.days || "30", 10))
    );
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Daily user registrations
    const dailyUsers = await User.findAll({
      attributes: [
        [fn("DATE", col("createdAt")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],
      where: { createdAt: { [Op.gte]: startDate } },
      group: [fn("DATE", col("createdAt"))],
      order: [[fn("DATE", col("createdAt")), "ASC"]],
    });

    // Daily guide creations
    const dailyGuides = await Guide.findAll({
      attributes: [
        [fn("DATE", col("createdAt")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],
      where: { createdAt: { [Op.gte]: startDate } },
      group: [fn("DATE", col("createdAt"))],
      order: [[fn("DATE", col("createdAt")), "ASC"]],
    });

    // Cumulative totals
    const totalsByDate = {};
    let cumulativeUsers = await User.count({
      where: { createdAt: { [Op.lt]: startDate } },
    });
    let cumulativeGuides = await Guide.count({
      where: { createdAt: { [Op.lt]: startDate } },
    });

    // Build date range
    for (
      let d = new Date(startDate);
      d <= new Date();
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().split("T")[0];
      totalsByDate[dateStr] = {
        date: dateStr,
        newUsers: 0,
        newGuides: 0,
        totalUsers: cumulativeUsers,
        totalGuides: cumulativeGuides,
      };
    }

    // Fill in daily counts
    dailyUsers.forEach((row) => {
      const date = row.get("date");
      const count = Number(row.get("count"));
      if (totalsByDate[date]) {
        totalsByDate[date].newUsers = count;
      }
    });

    dailyGuides.forEach((row) => {
      const date = row.get("date");
      const count = Number(row.get("count"));
      if (totalsByDate[date]) {
        totalsByDate[date].newGuides = count;
      }
    });

    // Calculate cumulative
    const sortedDates = Object.keys(totalsByDate).sort();
    sortedDates.forEach((date, i) => {
      if (i > 0) {
        const prev = totalsByDate[sortedDates[i - 1]];
        totalsByDate[date].totalUsers =
          prev.totalUsers + totalsByDate[date].newUsers;
        totalsByDate[date].totalGuides =
          prev.totalGuides + totalsByDate[date].newGuides;
      } else {
        totalsByDate[date].totalUsers += totalsByDate[date].newUsers;
        totalsByDate[date].totalGuides += totalsByDate[date].newGuides;
      }
    });

    res.json({
      success: true,
      activity: {
        days,
        startDate,
        data: sortedDates.map((date) => totalsByDate[date]),
      },
    });
  } catch (error) {
    console.error("Admin activity fetch error:", error);
    res.status(500).json({ message: "Failed to fetch activity data" });
  }
});

/**
 * GET /api/admin/growth
 * Get growth metrics and trends
 */
router.get("/growth", auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    // Get counts for current and previous months
    const [
      usersThisMonth,
      usersLastMonth,
      usersTwoMonthsAgo,
      guidesThisMonth,
      guidesLastMonth,
      guidesToMonthsAgo,
      totalUsers,
      totalGuides,
    ] = await Promise.all([
      User.count({ where: { createdAt: { [Op.gte]: thisMonth } } }),
      User.count({
        where: { createdAt: { [Op.gte]: lastMonth, [Op.lt]: thisMonth } },
      }),
      User.count({
        where: { createdAt: { [Op.gte]: twoMonthsAgo, [Op.lt]: lastMonth } },
      }),
      Guide.count({ where: { createdAt: { [Op.gte]: thisMonth } } }),
      Guide.count({
        where: { createdAt: { [Op.gte]: lastMonth, [Op.lt]: thisMonth } },
      }),
      Guide.count({
        where: { createdAt: { [Op.gte]: twoMonthsAgo, [Op.lt]: lastMonth } },
      }),
      User.count(),
      Guide.count(),
    ]);

    // Calculate growth rates
    const userGrowth =
      usersLastMonth > 0
        ? (((usersThisMonth - usersLastMonth) / usersLastMonth) * 100).toFixed(
            1
          )
        : usersThisMonth > 0
        ? 100
        : 0;

    const guideGrowth =
      guidesLastMonth > 0
        ? (
            ((guidesThisMonth - guidesLastMonth) / guidesLastMonth) *
            100
          ).toFixed(1)
        : guidesThisMonth > 0
        ? 100
        : 0;

    // Trend analysis
    const userTrend =
      usersThisMonth > usersLastMonth
        ? "up"
        : usersThisMonth < usersLastMonth
        ? "down"
        : "stable";
    const guideTrend =
      guidesThisMonth > guidesLastMonth
        ? "up"
        : guidesThisMonth < guidesLastMonth
        ? "down"
        : "stable";

    // Average guides per user
    const avgGuidesPerUser =
      totalUsers > 0 ? (totalGuides / totalUsers).toFixed(2) : 0;

    // Active users (users who created guides this month)
    const activeUsers = await Guide.count({
      where: { createdAt: { [Op.gte]: thisMonth } },
      distinct: true,
      col: "userId",
    });

    res.json({
      success: true,
      growth: {
        users: {
          total: totalUsers,
          thisMonth: usersThisMonth,
          lastMonth: usersLastMonth,
          growth: parseFloat(userGrowth),
          trend: userTrend,
        },
        guides: {
          total: totalGuides,
          thisMonth: guidesThisMonth,
          lastMonth: guidesLastMonth,
          growth: parseFloat(guideGrowth),
          trend: guideTrend,
          avgPerUser: parseFloat(avgGuidesPerUser),
        },
        engagement: {
          activeUsersThisMonth: activeUsers,
          activeRate:
            totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
        },
      },
    });
  } catch (error) {
    console.error("Admin growth fetch error:", error);
    res.status(500).json({ message: "Failed to fetch growth data" });
  }
});

/**
 * GET /api/admin/export/users
 * Export all users as CSV
 */
router.get("/export/users", auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "id",
        "email",
        "name",
        "subscription",
        "subscriptionStatus",
        "guidesUsed",
        "guidesLimit",
        "isBetaTester",
        "betaAccessLevel",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
    });

    // Build CSV
    const headers = [
      "ID",
      "Email",
      "Name",
      "Subscription",
      "Status",
      "Guides Used",
      "Guides Limit",
      "Beta Tester",
      "Beta Level",
      "Created At",
    ];
    const rows = users.map((u) => [
      u.id,
      u.email,
      u.name,
      u.subscription,
      u.subscriptionStatus,
      u.guidesUsed,
      u.guidesLimit,
      u.isBetaTester,
      u.betaAccessLevel,
      u.createdAt?.toISOString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v || ""}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=users-export-${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Admin export users error:", error);
    res.status(500).json({ message: "Failed to export users" });
  }
});

/**
 * GET /api/admin/export/guides
 * Export all guides as CSV
 */
router.get("/export/guides", auth, requireAdmin, async (req, res) => {
  try {
    const guides = await Guide.findAll({
      attributes: [
        "id",
        "guideId",
        "characterName",
        "productionTitle",
        "productionType",
        "genre",
        "roleSize",
        "isPublic",
        "viewCount",
        "createdAt",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Build CSV
    const headers = [
      "ID",
      "Guide ID",
      "Character",
      "Production",
      "Type",
      "Genre",
      "Role Size",
      "Public",
      "Views",
      "User Email",
      "Created At",
    ];
    const rows = guides.map((g) => [
      g.id,
      g.guideId,
      g.characterName,
      g.productionTitle,
      g.productionType,
      g.genre,
      g.roleSize,
      g.isPublic,
      g.viewCount,
      g.user?.email,
      g.createdAt?.toISOString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v || ""}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=guides-export-${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Admin export guides error:", error);
    res.status(500).json({ message: "Failed to export guides" });
  }
});

module.exports = router;
